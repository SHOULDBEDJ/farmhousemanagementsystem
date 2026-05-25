/**
 * local-db.ts — Complete localStorage-backed database.
 *
 * Replaces Supabase for all CRUD operations when the backend is offline.
 * Data persists in localStorage across page refreshes.
 *
 * Tables: bookings, incomes, expenses, income_types, expense_types,
 *         time_slots, activity_log, settings
 */

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function now(): string {
  return new Date().toISOString();
}

// ─── Core store ────────────────────────────────────────────────────────────────

function getTable<T extends { id: string }>(table: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(`ldb_${table}`) || "[]");
  } catch {
    return [];
  }
}

export function safeSetLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e: any) {
    if (e.name === "QuotaExceededError" || e.message?.toLowerCase().includes("quota")) {
      console.warn(`LocalStorage quota exceeded while setting key: ${key}! Initiating automated self-healing cleanup...`);
      // 1. Remove non-essential logs and backup histories
      localStorage.removeItem("ldb_activity_log");
      localStorage.removeItem("ldb_backup_history");
      
      // 2. Prune sync queue to the most recent 10 items
      try {
        const queueStr = localStorage.getItem("ldb_pending_sync_queue");
        if (queueStr) {
          const queue = JSON.parse(queueStr);
          if (queue.length > 10) {
            localStorage.setItem("ldb_pending_sync_queue", JSON.stringify(queue.slice(-10)));
          }
        }
      } catch {}
      
      // 3. Clear any uncompressed profile picture strings from other storage keys
      try {
        const user = localStorage.getItem("vault_user_data");
        if (user) {
          const u = JSON.parse(user);
          if (u.avatarUrl && u.avatarUrl.length > 200 * 1024) {
            u.avatarUrl = null;
            localStorage.setItem("vault_user_data", JSON.stringify(u));
          }
        }
      } catch {}
      
      // Retry writing the data
      try {
        localStorage.setItem(key, value);
        console.info(`Self-healing succeeded: key ${key} successfully written.`);
        return;
      } catch (retryErr) {
        console.error(`Self-healing failed to free up enough quota for key: ${key}`, retryErr);
        throw retryErr;
      }
    }
    throw e;
  }
}

function setTable<T extends { id: string }>(table: string, rows: T[]): void {
  safeSetLocalStorage(`ldb_${table}`, JSON.stringify(rows));
}

// ─── Public API ────────────────────────────────────────────────────────────────

export const ldb = {
  /** Return all non-deleted rows, newest first by created_at */
  list<T extends { id: string; deleted_at?: string | null; created_at?: string }>(
    table: string,
    orderBy: keyof T = "created_at" as keyof T,
    ascending = false,
  ): T[] {
    const rows = getTable<T>(table).filter((r) => !r.deleted_at);
    return rows.sort((a, b) => {
      const av = String(a[orderBy] ?? "");
      const bv = String(b[orderBy] ?? "");
      return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  },

  /** Return all rows (including deleted) */
  all<T extends { id: string }>(table: string): T[] {
    return getTable<T>(table);
  },

  /** Find a single row by id */
  find<T extends { id: string }>(table: string, id: string): T | null {
    return getTable<T>(table).find((r) => r.id === id) ?? null;
  },

  /** Insert a new row. Returns the created row. */
  insert<T extends { id?: string }>(table: string, data: T): T & { id: string; created_at: string } {
    const rows = getTable<T & { id: string; created_at: string }>(table);
    const row = { ...data, id: data.id ?? uuid(), created_at: now() } as T & {
      id: string;
      created_at: string;
    };
    rows.push(row);
    setTable(table, rows);
    return row;
  },

  /** Update a row by id. Returns the updated row or null. */
  update<T extends { id: string }>(table: string, id: string, patch: Partial<T>): T | null {
    const rows = getTable<T>(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...patch, updated_at: now() } as T;
    setTable(table, rows);
    return rows[idx];
  },

  /** Hard delete a row by id */
  delete(table: string, id: string): boolean {
    const rows = getTable(table);
    const filtered = rows.filter((r) => r.id !== id);
    if (filtered.length === rows.length) return false;
    setTable(table, filtered);
    return true;
  },

  /** Soft delete (set deleted_at) */
  softDelete(table: string, id: string): void {
    this.update(table, id, { deleted_at: now() } as any);
  },

  /** Filter rows by field equality (non-deleted only) */
  where<T extends { id: string; deleted_at?: string | null }>(
    table: string,
    field: keyof T,
    value: any,
  ): T[] {
    return getTable<T>(table).filter((r) => !r.deleted_at && r[field] === value);
  },

  // ─── Offline synchronization queue ──────────────────────────────────────────
  getPendingSyncQueue(): any[] {
    try {
      return JSON.parse(localStorage.getItem("ldb_pending_sync_queue") || "[]");
    } catch {
      return [];
    }
  },

  addToPendingSyncQueue(item: { id?: string; table: string; action: "insert" | "update" | "delete"; targetId?: string; payload?: any }) {
    const queue = this.getPendingSyncQueue();
    queue.push({
      id: item.id ?? uuid(),
      table: item.table,
      action: item.action,
      targetId: item.targetId,
      payload: item.payload,
      timestamp: Date.now(),
    });
    safeSetLocalStorage("ldb_pending_sync_queue", JSON.stringify(queue));
  },

  removeFromPendingSyncQueue(id: string) {
    const queue = this.getPendingSyncQueue().filter((item: any) => item.id !== id);
    safeSetLocalStorage("ldb_pending_sync_queue", JSON.stringify(queue));
  },

  getTableData(table: string): any[] {
    return getTable(table);
  },

  setTableData(table: string, data: any[]): void {
    setTable(table, data);
  },
};

// ─── Seed default types if tables are empty ───────────────────────────────────

export function seedDefaultData() {
  if (ldb.list("income_types").length === 0) {
    ["Booking", "Event", "Food & Beverage", "Other"].forEach((name) =>
      ldb.insert<any>("income_types", { name }),
    );
  }
  if (ldb.list("expense_types").length === 0) {
    ["Maintenance", "Utilities", "Staff", "Supplies", "Other"].forEach((name) =>
      ldb.insert<any>("expense_types", { name }),
    );
  }
  if (ldb.list("time_slots").length === 0) {
    ldb.insert<any>("time_slots", {
      name: "Day",
      start_time: "09:00",
      end_time: "18:00",
      color: "#3B82F6",
      is_overnight: false,
    });
    ldb.insert<any>("time_slots", {
      name: "Night",
      start_time: "20:00",
      end_time: "06:00",
      color: "#8B5CF6",
      is_overnight: true,
    });
    ldb.insert<any>("time_slots", {
      name: "Full Day",
      start_time: "09:00",
      end_time: "22:00",
      color: "#10B981",
      is_overnight: false,
    });
  }
}
