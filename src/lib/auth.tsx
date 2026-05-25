// Real Supabase auth + "Hidden Vault" fallback for internal users
// Vault users are stored entirely in localStorage — no Supabase needed.
import { useEffect, useState, createContext, useContext, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { seedDefaultData, ldb } from "@/lib/local-db";

export type AppRole = "SuperAdmin" | "Admin" | "Staff";

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: AppRole;
  avatarUrl: string | null;
  permissions?: any;
  isVaultUser?: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

// ─── Local Vault (localStorage-based, zero Supabase calls) ──────────────────
const VAULT_KEY = "local_vault_users";
const VAULT_SESSION_KEY = "vault_session_id";
const VAULT_USER_KEY = "vault_user_data";

function getLocalVault(): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(VAULT_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLocalVault(vault: Record<string, any>) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

function getLocalSession(): AuthUser | null {
  try {
    const data = localStorage.getItem(VAULT_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/** Seeds the default admin into the local vault on first run */
function ensureDefaultAdmin() {
  const vault = getLocalVault();
  if (!vault["narayansolanke"]) {
    vault["narayansolanke"] = {
      id: "admin-001",
      username: "narayansolanke",
      password: "narayansolanke",
      fullName: "Narayan Solanki",
      role: "SuperAdmin",
      avatarUrl: null,
      permissions: { all: true },
      isVaultUser: true,
    };
    saveLocalVault(vault);
  }
  // Seed default categories and time slots for offline use
  seedDefaultData();
}

function cleanAndCompressStoredAvatars() {
  try {
    const sessionUserStr = localStorage.getItem("vault_user_data");
    if (sessionUserStr) {
      const u = JSON.parse(sessionUserStr);
      if (u.avatarUrl && u.avatarUrl.length > 200 * 1024) {
        console.warn("Synchronously clearing bloated session avatar to recover quota...");
        const originalUrl = u.avatarUrl;
        u.avatarUrl = null;
        try {
          localStorage.setItem("vault_user_data", JSON.stringify(u));
        } catch {}

        compressBase64Image(originalUrl, (resized) => {
          u.avatarUrl = resized;
          try {
            localStorage.setItem("vault_user_data", JSON.stringify(u));
            console.info("Session avatar compressed and recovered.");
          } catch (e) {
            u.avatarUrl = null;
            localStorage.setItem("vault_user_data", JSON.stringify(u));
          }
        });
      }
    }

    const vaultStr = localStorage.getItem("local_vault_users");
    if (vaultStr) {
      const vault = JSON.parse(vaultStr);
      let changed = false;
      const originalAvatars: Record<string, string> = {};

      for (const k of Object.keys(vault)) {
        const u = vault[k];
        if (u.avatarUrl && u.avatarUrl.length > 200 * 1024) {
          console.warn(`Synchronously clearing bloated avatar for user: ${k}...`);
          originalAvatars[k] = u.avatarUrl;
          u.avatarUrl = null;
          changed = true;
        }
      }

      if (changed) {
        try {
          localStorage.setItem("local_vault_users", JSON.stringify(vault));
        } catch {}

        for (const k of Object.keys(originalAvatars)) {
          compressBase64Image(originalAvatars[k], (resized) => {
            vault[k].avatarUrl = resized;
            try {
              localStorage.setItem("local_vault_users", JSON.stringify(vault));
              console.info(`Avatar for user ${k} compressed and recovered.`);
            } catch (e) {
              vault[k].avatarUrl = null;
              localStorage.setItem("local_vault_users", JSON.stringify(vault));
            }
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to cleanup bloated avatars:", err);
  }
}

function compressBase64Image(base64: string, callback: (resized: string) => void) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const size = Math.min(img.width, img.height);
      const sX = (img.width - size) / 2;
      const sY = (img.height - size) / 2;
      ctx.drawImage(img, sX, sY, size, size, 0, 0, 128, 128);
      callback(canvas.toDataURL("image/jpeg", 0.6));
    } else {
      callback(base64.substring(0, 1000));
    }
  };
  img.onerror = () => {
    callback(base64.substring(0, 1000));
  };
  img.src = base64;
}

// ─── Supabase profile loader (only for real Supabase Auth users) ─────────────
async function loadSupabaseProfile(userId: string): Promise<AuthUser | null> {
  try {
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, full_name, email, avatar_url")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role, permissions").eq("user_id", userId),
    ]);

    if (!profile) return null;

    const list = (roles ?? []).map((r) => r.role as AppRole);
    const role: AppRole = list.includes("SuperAdmin")
      ? "SuperAdmin"
      : list.includes("Admin")
      ? "Admin"
      : "Staff";
    const permissions = roles?.find((r) => r.role === role)?.permissions;
    return {
      id: profile.id,
      username: profile.username,
      fullName: profile.full_name,
      email: profile.email,
      avatarUrl: profile.avatar_url,
      role,
      permissions,
    };
  } catch {
    return null;
  }
}

// ─── AuthProvider ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // 1. Vault session check — completely offline, no network call
    const vaultSid = localStorage.getItem(VAULT_SESSION_KEY);
    if (vaultSid) {
      const cached = getLocalSession();
      if (cached) {
        // Sync display name and avatarUrl from the database settings table if available
        const settingsList = ldb.all("settings");
        const settings = settingsList.length > 0 ? (settingsList[0] as any) : null;
        if (settings) {
          if (settings.owner_name) cached.fullName = settings.owner_name;
          if (settings.watermark_url) cached.avatarUrl = settings.watermark_url;
        }
        setUser(cached);
        setLoading(false);
        return;
      }
      // Stale session ID with no user data — clean up
      localStorage.removeItem(VAULT_SESSION_KEY);
    }

    // 2. Real Supabase session (only if no vault session)
    try {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session) {
        const u = await loadSupabaseProfile(data.session.user.id);
        setUser(u);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Seed default admin locally on every app start
    ensureDefaultAdmin();

    // Clean up and downscale existing bloated avatars in localStorage
    cleanAndCompressStoredAvatars();

    // Only listen to Supabase auth changes for real Supabase users
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (localStorage.getItem(VAULT_SESSION_KEY)) return; // vault user — ignore
      setSession(s);
      if (s) {
        setTimeout(async () => setUser(await loadSupabaseProfile(s.user.id)), 0);
      } else {
        setUser(null);
      }
    });

    refresh().finally(() => setLoading(false));
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const login = async (username: string, password: string, _remember: boolean) => {
    // 1. Try local vault first — zero network required
    ensureDefaultAdmin();
    const vault = getLocalVault();
    const match = Object.values(vault).find(
      (u: any) => u.username === username.trim() && u.password === password,
    ) as any;

    if (match) {
      const authUser: AuthUser = {
        id: match.id,
        username: match.username,
        fullName: match.fullName,
        email: null,
        avatarUrl: match.avatarUrl || null,
        role: match.role as AppRole,
        permissions: match.permissions,
        isVaultUser: true,
      };
      
      // Override details from local settings if available
      const settingsList = ldb.all("settings");
      const settings = settingsList.length > 0 ? (settingsList[0] as any) : null;
      if (settings) {
        if (settings.owner_name) authUser.fullName = settings.owner_name;
        if (settings.watermark_url) authUser.avatarUrl = settings.watermark_url;
      }

      localStorage.setItem(VAULT_SESSION_KEY, match.id);
      localStorage.setItem(VAULT_USER_KEY, JSON.stringify(authUser));
      setUser(authUser);
      toast.success("Welcome back, " + authUser.fullName);
      return;
    }

    // 2. Fallback to real Supabase email/password auth
    const email = (username.includes("@") ? username : `${username}@local`).toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Invalid username or password");
  };

  const logout = async () => {
    localStorage.removeItem(VAULT_SESSION_KEY);
    localStorage.removeItem(VAULT_USER_KEY);
    setUser(null);
    setSession(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // Supabase may be unreachable — safe to ignore for vault users
    }
  };

  return (
    <Ctx.Provider value={{ user, session, loading, login, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

export function canAccess(role: AppRole | undefined, route: string): boolean {
  if (!role) return false;
  if (route.startsWith("/settings")) return role === "SuperAdmin";
  if (route.startsWith("/reports"))
    return role === "SuperAdmin" || role === "Admin";
  return true;
}
