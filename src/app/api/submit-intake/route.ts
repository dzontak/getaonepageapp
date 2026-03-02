/**
 * POST /api/submit-intake
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
 * Required env vars (set in Vercel dashboard → Settings → Environment Variables):
 *   ANTHROPIC_API_KEY        — Anthropic API key
 *
 * Optional env vars (email notifications):
 *   RESEND_API_KEY           — Resend API key
 *   NOTIFY_EMAIL             — team notification address
 *   FROM_EMAIL               — verified sender (e.g. noreply@getaonepageapp.com)
 *
 * Optional env vars (auto-build + deploy to Cloudflare Pages):
 *   CLOUDFLARE_API_TOKEN     — Cloudflare API token with Pages:Edit permission
 *   CLOUDFLARE_ACCOUNT_ID    — Cloudflare account ID
 *
 * Optional KV (session persistence + credits — Upstash Redis via Vercel Marketplace):
 *   UPSTASH_REDIS_REST_URL   — set automatically when Upstash Redis is connected
 *   UPSTASH_REDIS_REST_TOKEN — set automatically when Upstash Redis is connected
 */

import { NextRequest, NextResponse } from "next/server";
import type { ProjectIntakeData } from "@/lib/intake-types";
import type { SessionContext } from "@/lib/graph-types";
import { createSession, saveSession } from "@/lib/graph-state";
import { executeGraph, type GraphEnv } from "@/lib/graph-executor";

// Vercel serverless function max duration (Pro plan allows up to 60s)
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
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
      return NextResponse.json(
        { error: "Missing required fields: data, plainText" },
        { status: 400 },
      );
    }

    intakeData = body.data as ProjectIntakeData;
    plainText = body.plainText.trim();
    iterationCount = typeof body.iterationCount === "number" ? body.iterationCount : 0;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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

  // ── Build env (lazy-load Redis only if configured) ─────────────────────────
  const kvConfigured = !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );

  let kvClient: GraphEnv["INTAKE_KV"] = undefined;
  if (kvConfigured) {
    // Dynamic import avoids hard crash when Redis env vars are absent
    const { Redis } = await import("@upstash/redis");
    kvClient = Redis.fromEnv();
  }

  const env: GraphEnv = {
    ANTHROPIC_API_KEY: apiKey,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NOTIFY_EMAIL: process.env.NOTIFY_EMAIL,
    FROM_EMAIL: process.env.FROM_EMAIL,
    INTAKE_KV: kvClient,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  };

  // Persist initial state (Resumable from the start)
  if (env.INTAKE_KV) {
    await saveSession(state, env.INTAKE_KV);
  }

  // ── Execute the graph ───────────────────────────────────────────────────────
  try {
    const result = await executeGraph(state, env);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Graph execution failed:", err);
    return NextResponse.json(
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

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}
