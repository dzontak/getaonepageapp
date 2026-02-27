/**
 * KV state management for the Attractor execution model.
 *
 * Two namespaces stored under the INTAKE_KV binding:
 *   session:{sessionId}  →  ExecutionState  (TTL: 30 days)
 *   credits:{email}      →  CreditRecord    (no TTL — permanent record)
 *
 * The KV binding (INTAKE_KV) must be created in the Cloudflare Pages dashboard:
 *   Settings → Functions → KV namespace bindings → Add binding
 *   Variable name: INTAKE_KV
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

/* ─── Session CRUD ─── */

export async function loadSession(
  sessionId: string,
  kv: KVNamespace,
): Promise<ExecutionState | null> {
  const raw = await kv.get(`${SESSION_KV_PREFIX}${sessionId}`);
  if (!raw) return null;
  return JSON.parse(raw) as ExecutionState;
}

export async function saveSession(
  state: ExecutionState,
  kv: KVNamespace,
): Promise<void> {
  const updated: ExecutionState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await kv.put(
    `${SESSION_KV_PREFIX}${state.sessionId}`,
    JSON.stringify(updated),
    { expirationTtl: SESSION_TTL_SECONDS },
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
  kv: KVNamespace,
): Promise<CreditRecord | null> {
  const raw = await kv.get(`${CREDITS_KV_PREFIX}${email}`);
  if (!raw) return null;
  return JSON.parse(raw) as CreditRecord;
}

export async function saveCredits(
  record: CreditRecord,
  kv: KVNamespace,
): Promise<void> {
  await kv.put(
    `${CREDITS_KV_PREFIX}${record.email}`,
    JSON.stringify({ ...record, updatedAt: new Date().toISOString() }),
  );
}

/**
 * Get the credit record for a client, creating it with the default
 * allocation if it doesn't exist yet.
 */
export async function getOrCreateCredits(
  email: string,
  kv: KVNamespace,
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
  kv: KVNamespace,
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
