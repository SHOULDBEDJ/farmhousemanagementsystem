import { ldb } from "./local-db";
import { toast } from "sonner";

// Keep track of syncing state to prevent concurrent runs
let isSyncing = false;
let syncTimeout: any = null;

// Access to raw supabase client to bypass proxy
let getRawSupabaseClient: () => any = () => null;

export function registerRawClientGetter(getter: () => any) {
  getRawSupabaseClient = getter;
}

/**
 * Checks if the system is currently online by making a fast HEAD request to Supabase URL.
 */
export async function checkOnlineStatus(): Promise<boolean> {
  if (!navigator.onLine) return false;
  const raw = getRawSupabaseClient();
  if (!raw) return false;
  
  try {
    // Quick ping to check if the Supabase url is reachable
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${raw.supabaseUrl}/rest/v1/`, {
      method: "HEAD",
      headers: { apikey: raw.supabaseKey },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok || res.status === 401; // 401 is fine, means server responded
  } catch {
    return false;
  }
}

/**
 * Syncs pending local mutations to Supabase.
 */
export async function syncPendingMutations(): Promise<boolean> {
  if (isSyncing) return false;
  
  const queue = ldb.getPendingSyncQueue();
  if (queue.length === 0) return true;
  
  const raw = getRawSupabaseClient();
  if (!raw) return false;
  
  isSyncing = true;
  const toastId = toast.loading(`Syncing ${queue.length} offline changes...`);
  
  let successCount = 0;
  let hasNetworkError = false;
  
  try {
    for (const item of queue) {
      let res: { error: any } = { error: null };
      
      try {
        if (item.action === "insert") {
          // Check if it already exists to prevent duplicate inserts
          const { data: existing } = await raw.from(item.table).select("id").eq("id", item.payload.id).maybeSingle();
          if (existing) {
            // Already synced, just remove from queue
            ldb.removeFromPendingSyncQueue(item.id);
            successCount++;
            continue;
          }
          res = await raw.from(item.table).insert(item.payload);
        } else if (item.action === "update") {
          res = await raw.from(item.table).update(item.payload).eq("id", item.targetId);
        } else if (item.action === "delete") {
          res = await raw.from(item.table).delete().eq("id", item.targetId);
        }
      } catch (err: any) {
        res = { error: err };
      }
      
      if (res.error) {
        const errMsg = res.error.message || String(res.error);
        console.error(`Sync error for table ${item.table}, action ${item.action}:`, res.error);
        
        // If it's a network offline/timeout error, abort the sync
        if (errMsg.includes("offline") || errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError") || errMsg.includes("AbortError")) {
          hasNetworkError = true;
          break;
        } else {
          // Permanent database error (e.g. key conflict, data validation), log and remove to prevent blocking queue
          ldb.removeFromPendingSyncQueue(item.id);
        }
      } else {
        ldb.removeFromPendingSyncQueue(item.id);
        successCount++;
      }
    }
  } finally {
    isSyncing = false;
  }
  
  if (successCount > 0) {
    toast.success(`Successfully synced ${successCount} offline changes!`, { id: toastId });
  } else if (hasNetworkError) {
    toast.error("Sync paused. Server is offline.", { id: toastId });
    return false;
  } else {
    toast.dismiss(toastId);
  }
  
  return true;
}

/**
 * Downloads the latest online snapshot for local caching.
 */
export async function pullOnlineSnapshots() {
  const raw = getRawSupabaseClient();
  if (!raw) return;
  
  const tables = ["time_slots", "income_types", "expense_types", "bookings", "incomes", "expenses", "settings"];
  
  for (const table of tables) {
    try {
      let query = raw.from(table).select("*");
      if (table === "bookings" || table === "incomes" || table === "expenses") {
        query = query.is("deleted_at", null);
      }
      const { data, error } = await query;
      if (!error && data) {
        ldb.setTableData(table, data);
      }
    } catch (err) {
      console.warn(`Failed to pull cache for table ${table}:`, err);
    }
  }
}

/**
 * Initialize background sync service.
 */
export function startSyncService() {
  if (syncTimeout) return;
  
  const runSyncCycle = async () => {
    const isOnline = await checkOnlineStatus();
    if (isOnline) {
      const syncOk = await syncPendingMutations();
      if (syncOk) {
        await pullOnlineSnapshots();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("database-change"));
        }
      }
    }
    syncTimeout = setTimeout(runSyncCycle, 60_000); // Check/Sync every minute
  };
  
  // Listen for browser online event
  window.addEventListener("online", () => {
    toast.info("Connection restored. Syncing database...");
    syncPendingMutations().then((ok) => {
      if (ok) {
        pullOnlineSnapshots().then(() => {
          window.dispatchEvent(new CustomEvent("database-change"));
        });
      }
    });
  });
  
  window.addEventListener("offline", () => {
    toast.warning("You are offline. Changes will be saved locally.");
  });

  // Listen for real-time updates from Supabase Postgres changes publication
  const raw = getRawSupabaseClient();
  if (raw) {
    raw.channel("db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        async (payload: any) => {
          const tables = ["time_slots", "income_types", "expense_types", "bookings", "incomes", "expenses", "settings"];
          if (tables.includes(payload.table)) {
            console.info(`[Realtime Sync] Change detected on ${payload.table}:`, payload);
            await pullOnlineSnapshots();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("database-change"));
            }
          }
        }
      )
      .subscribe();
  }
  
  // Start first run
  runSyncCycle();
}
