/**
 * db.ts — Timeout-safe Supabase query wrapper + shared helpers.
 *
 * Use query() for reads and mutate() for writes so pages fail fast
 * (≤3 s) when Supabase is unreachable, instead of spinning for 60 s.
 */

const TIMEOUT_MS = 3_000;

type SupabaseQuery<T> = PromiseLike<{ data: T | null; error: any }>;

/** Runs a Supabase SELECT with a timeout. Returns `fallback` on failure. */
export async function query<T>(
  promise: SupabaseQuery<T>,
  fallback: T,
): Promise<T> {
  const timeout = new Promise<{ data: T | null; error: any }>((resolve) =>
    setTimeout(() => resolve({ data: null, error: new Error("timeout") }), TIMEOUT_MS),
  );
  try {
    const { data, error } = await Promise.race([promise, timeout]);
    if (error || data === null) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

/** Runs a Supabase INSERT/UPDATE/DELETE with a timeout. Returns { data, error }. */
export async function mutate<T>(
  promise: SupabaseQuery<T>,
): Promise<{ data: T | null; error: any }> {
  const timeout = new Promise<{ data: T | null; error: any }>((resolve) =>
    setTimeout(
      () => resolve({ data: null, error: new Error("Network timeout — Supabase unreachable") }),
      TIMEOUT_MS,
    ),
  );
  try {
    return await Promise.race([promise, timeout]);
  } catch (e: any) {
    return { data: null, error: e };
  }
}

/**
 * Logs an activity to Supabase activity_log.
 * Silently swallows errors — a missing backend must never crash the UI.
 */
export async function logActivity(
  action: string,
  module: string,
  detail: string,
  userId?: string,
): Promise<void> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const insert = supabase.from("activity_log").insert({
      action,
      module,
      detail,
      user_id: userId ?? "00000000-0000-0000-0000-000000000000",
    });
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, TIMEOUT_MS));
    await Promise.race([insert, timeout]);
  } catch {
    // Supabase unavailable — activity not logged, UI continues normally
  }
}
