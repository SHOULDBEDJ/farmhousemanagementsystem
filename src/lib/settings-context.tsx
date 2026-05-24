import React, { createContext, useContext, useEffect, useState } from "react";

// Default settings stored locally — no Supabase dependency
const LOCAL_SETTINGS_KEY = "local_app_settings";

const DEFAULT_SETTINGS = {
  farmhouse_name: "The 16 EYES Farm House",
  accent_color: "#1a237e",
};

interface SettingsContextType {
  settings: any;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function getLocalSettings(): any {
  try {
    const saved = localStorage.getItem(LOCAL_SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function applyAccentColor(color: string) {
  if (typeof window !== "undefined") {
    document.documentElement.style.setProperty("--navy", color);
    document.documentElement.style.setProperty("--navy-hover", color + "ee");
  }
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    // Load from localStorage immediately — no network call
    const localSettings = getLocalSettings();
    setSettings(localSettings);
    if (localSettings.accent_color) {
      applyAccentColor(localSettings.accent_color);
    }

    // Optionally try Supabase in background (won't block UI)
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("settings").select("*").maybeSingle();
      if (data) {
        const merged = { ...localSettings, ...data };
        setSettings(merged);
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(merged));
        if (data.accent_color) applyAccentColor(data.accent_color);
      }
    } catch {
      // Supabase unreachable — local settings already applied, nothing to do
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
