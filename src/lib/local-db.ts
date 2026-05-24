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

function setTable<T extends { id: string }>(table: string, rows: T[]): void {
  localStorage.setItem(`ldb_${table}`, JSON.stringify(rows));
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
    if (filtered.length === filtered.length && filtered.length === rows.length) return false;
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
