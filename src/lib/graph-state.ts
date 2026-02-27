/**
 * KV state management for the Attractor execution model.
 *
 * Two namespaces:
 *   session:{sessionId}  →  ExecutionState  (TTL: 30 days)
 *   credits:{email}      →  CreditRecord    (no TTL — permanent record)
 *
 * Uses a minimal KVStore interface compatible with @vercel/kv (and any
 * Redis-like store). Configure Vercel KV in the dashboard and pass the
 * imported `kv` client from @vercel/kv as INTAKE_KV in GraphEnv.
 */

import type {
  ExecutionState,
  CreditRecord,
  NodeId,
  SessionContext,
} from "./graph-types";
import {
  CREDITS_INCLUDED,
  CREDITS_KV_PREFIX,
  SESSION_KV_PREFIX,
  SESSION_TTL_SECONDS,
} from "./graph-types";

/**
 * Minimal KV store interface — compatible with @vercel/kv.
 * `get` returns parsed JSON directly; `set` accepts native objects.
 */
export interface KVStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
}

/* ─── Session CRUD ─── */

export async function loadSession(
  sessionId: string,
  kv: KVStore,
): Promise<ExecutionState | null> {
  return kv.get<ExecutionState>(`${SESSION_KV_PREFIX}${sessionId}`);
}

export async function saveSession(
  state: ExecutionState,
  kv: KVStore,
): Promise<void> {
  const updated: ExecutionState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await kv.set(
    `${SESSION_KV_PREFIX}${state.sessionId}`,
    updated,
    { ex: SESSION_TTL_SECONDS },
  );
}

export function createSession(
  sessionId: string,
  context: SessionContext,
): ExecutionState {
  const now = new Date().toISOString();
  return {
    sessionId,
    currentNode: "assess" as NodeId,
    context,
    history: [],
    status: "running",
    createdAt: now,
    updatedAt: now,
  };
}

/* ─── Credit CRUD ─── */

export async function loadCredits(
  email: string,
  kv: KVStore,
): Promise<CreditRecord | null> {
  return kv.get<CreditRecord>(`${CREDITS_KV_PREFIX}${email}`);
}

export async function saveCredits(
  record: CreditRecord,
  kv: KVStore,
): Promise<void> {
  await kv.set(
    `${CREDITS_KV_PREFIX}${record.email}`,
    { ...record, updatedAt: new Date().toISOString() },
  );
}

/**
 * Get the credit record for a client, creating it with the default
 * allocation if it doesn't exist yet.
 */
export async function getOrCreateCredits(
  email: string,
  kv: KVStore,
): Promise<CreditRecord> {
  const existing = await loadCredits(email, kv);
  if (existing) return existing;

  const now = new Date().toISOString();
  const record: CreditRecord = {
    email,
    total: CREDITS_INCLUDED,
    used: 0,
    plan: "standard",
    createdAt: now,
    updatedAt: now,
  };
  await saveCredits(record, kv);
  return record;
}

/**
 * Deduct one credit from the record.
 * Returns the updated record with the new `used` count.
 * Throws if the record has no remaining credits.
 */
export async function deductCredit(
  email: string,
  kv: KVStore,
): Promise<CreditRecord> {
  const record = await getOrCreateCredits(email, kv);
  const remaining = record.total - record.used;
  if (remaining <= 0) {
    throw new Error("No credits remaining");
  }
  const updated: CreditRecord = { ...record, used: record.used + 1 };
  await saveCredits(updated, kv);
  return updated;
}

export function creditsRemaining(record: CreditRecord): number {
  return Math.max(0, record.total - record.used);
}
