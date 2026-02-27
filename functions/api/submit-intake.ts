/**
 * Cloudflare Pages Function: POST /api/submit-intake
 *
 * Entry point for the Attractor execution graph.
 *
 * Receives the form data + pre-formatted plain-text brief, creates a session,
 * and runs the full 4-node graph synchronously:
 *
 *   assess → generate → validate (→ generate retry) → deliver
 *
 * Returns GraphResult { sessionId, status, enhancement, validationScore,
 *                       creditsRemaining, history }
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY   — Anthropic API key
 *
 * Optional env vars (email + credits):
 *   RESEND_API_KEY      — Resend API key
 *   NOTIFY_EMAIL        — team notification address
 *   FROM_EMAIL          — verified sender (e.g. noreply@getaonepageapp.com)
 *
 * Required KV binding (add in Cloudflare Pages → Settings → Functions → KV):
 *   INTAKE_KV           — KV namespace for sessions + credits
 */

import type { ProjectIntakeData } from "../lib/intake-types";
import type { SessionContext } from "../lib/graph-types";
import { createSession } from "../lib/graph-state";
import { executeGraph, type GraphEnv } from "../lib/graph-executor";

interface Env extends GraphEnv {
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL?: string;
  FROM_EMAIL?: string;
  INTAKE_KV?: KVNamespace;
}

export async function onRequestPost(
  context: EventContext<Env, string, unknown>,
): Promise<Response> {
  const { request, env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let intakeData: ProjectIntakeData;
  let plainText: string;
  let iterationCount = 0;

  try {
    const body = await request.json() as {
      data?: unknown;
      plainText?: unknown;
      iterationCount?: unknown;
    };

    if (!body.data || typeof body.plainText !== "string" || !body.plainText.trim()) {
      return Response.json(
        { error: "Missing required fields: data, plainText" },
        { status: 400 },
      );
    }

    intakeData = body.data as ProjectIntakeData;
    plainText = body.plainText.trim();
    iterationCount = typeof body.iterationCount === "number" ? body.iterationCount : 0;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Create session + initial context ───────────────────────────────────────
  const sessionId = crypto.randomUUID();

  const sessionContext: SessionContext = {
    intakeData,
    plainText,
    generateAttempts: 0,
    iterationCount,
  };

  const state = createSession(sessionId, sessionContext);

  // Persist initial state (Resumable from the start)
  if (env.INTAKE_KV) {
    const { saveSession } = await import("../lib/graph-state");
    await saveSession(state, env.INTAKE_KV);
  }

  // ── Execute the graph ───────────────────────────────────────────────────────
  try {
    const result = await executeGraph(state, env);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Graph execution failed:", err);
    return Response.json(
      {
        error: err instanceof Error ? err.message : "Graph execution failed",
        sessionId,
        status: "failed",
        history: state.history,
      },
      { status: 502 },
    );
  }
}

export async function onRequestGet(): Promise<Response> {
  return Response.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}
