/**
 * Attractor execution engine.
 *
 * Implements the four core properties:
 *   Deterministic — same inputs produce the same graph traversal
 *   Observable    — every node transition is logged with timestamp + duration
 *   Resumable     — state is persisted to KV after every transition
 *   Composable    — executeGraph() is a pure async function; embeddable in larger graphs
 *
 * Graph topology:
 *   assess → generate → validate → deliver
 *                 ↑         │ (needs_revision, attempts < 2)
 *                 └─────────┘
 */

import type {
  ExecutionState,
  SessionContext,
  NodeId,
  EdgeLabel,
  NodeTransition,
  GraphResult,
  AssessOutput,
  GenerateOutput,
  ValidateOutput,
} from "./graph-types";
import {
  saveSession,
  getOrCreateCredits,
  deductCredit,
  creditsRemaining,
} from "./graph-state";
import {
  NODE_PROMPTS,
  parseAssessOutput,
  parseGenerateOutput,
  parseValidateOutput,
} from "./graph-nodes";
import { teamEmailHtml, clientEmailHtml } from "./email-templates";

/* ─── Environment Interface ─── */

export interface GraphEnv {
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL?: string;
  FROM_EMAIL?: string;
  INTAKE_KV?: KVNamespace;
}

/* ─── Constants ─── */

const MAX_GENERATE_ATTEMPTS = 2;   // 1 initial + 1 retry on validation failure
const VALIDATE_PASS_THRESHOLD = 7; // out of 10

/* ─── Main Entry Point ─── */

/**
 * Run the full Attractor graph for a session.
 * Mutates `state` in place and persists it to KV after every transition.
 * Returns the final GraphResult.
 */
export async function executeGraph(
  state: ExecutionState,
  env: GraphEnv,
): Promise<GraphResult> {
  try {
    // ── Traverse until terminal ──────────────────────────────────────────────
    while (state.currentNode !== "deliver" && state.status === "running") {
      const startMs = Date.now();

      // Execute current node
      const { output, nextNode, edge } = await executeNode(state.currentNode, state.context, env);

      // Update context with node output
      applyOutput(state.context, state.currentNode, output);

      // Record the transition (Observable)
      const transition: NodeTransition = {
        from: state.currentNode,
        to: nextNode,
        edge,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startMs,
      };
      state.history.push(transition);
      state.currentNode = nextNode;

      // Persist after every transition (Resumable)
      if (env.INTAKE_KV) {
        await saveSession(state, env.INTAKE_KV);
      }
    }

    // ── Deliver node ─────────────────────────────────────────────────────────
    const deliverStartMs = Date.now();
    const deliverOutput = await executeDeliverNode(state.context, env);

    state.history.push({
      from: "deliver",
      to: "deliver",
      edge: "done",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - deliverStartMs,
    });
    state.context.delivery = deliverOutput;
    state.status = "completed";

    if (env.INTAKE_KV) {
      await saveSession(state, env.INTAKE_KV);
    }

    return buildResult(state);
  } catch (err) {
    state.status = "failed";
    state.error = err instanceof Error ? err.message : String(err);
    if (env.INTAKE_KV) {
      await saveSession(state, env.INTAKE_KV).catch(() => undefined);
    }
    throw err;
  }
}

/* ─── Node Executor ─── */

async function executeNode(
  nodeId: Exclude<NodeId, "deliver">,
  context: SessionContext,
  env: GraphEnv,
): Promise<{ output: AssessOutput | GenerateOutput | ValidateOutput; nextNode: NodeId; edge: EdgeLabel }> {

  const prompt = NODE_PROMPTS[nodeId](context);
  const rawText = await callClaude(prompt, env.ANTHROPIC_API_KEY);

  switch (nodeId) {
    case "assess": {
      const output = parseAssessOutput(rawText);
      return { output, nextNode: "generate", edge: "proceed" };
    }

    case "generate": {
      context.generateAttempts += 1;
      const output = parseGenerateOutput(rawText);
      return { output, nextNode: "validate", edge: "generated" };
    }

    case "validate": {
      const output = parseValidateOutput(rawText);
      const canRetry = context.generateAttempts < MAX_GENERATE_ATTEMPTS;

      if (output.overallScore >= VALIDATE_PASS_THRESHOLD) {
        return { output, nextNode: "deliver", edge: "passes" };
      } else if (canRetry) {
        return { output, nextNode: "generate", edge: "needs_revision" };
      } else {
        // Circuit breaker: deliver best effort
        return { output, nextNode: "deliver", edge: "max_retries" };
      }
    }
  }
}

/* ─── Deliver Node (procedural — no LLM call) ─── */

async function executeDeliverNode(
  context: SessionContext,
  env: GraphEnv,
): Promise<{ teamEmailSent: boolean; clientEmailSent: boolean; creditsRemaining: number; edge: "done" }> {
  const email = context.intakeData.contact.email;
  const enhancement = context.enhancement;

  if (!enhancement) {
    throw new Error("Cannot deliver: no enhancement output from generate node");
  }

  // ── Credits ────────────────────────────────────────────────────────────────
  let remaining = 3; // default if KV not configured
  if (env.INTAKE_KV && email) {
    if (context.iterationCount > 0) {
      // Revisions cost a credit; first submission is always free
      try {
        const record = await deductCredit(email, env.INTAKE_KV);
        remaining = creditsRemaining(record);
      } catch {
        // No credits remaining — log but still deliver (enforcement in V2)
        console.warn(`No credits for ${email} — delivering anyway (credit enforcement pending)`);
        const record = await getOrCreateCredits(email, env.INTAKE_KV);
        remaining = creditsRemaining(record);
      }
    } else {
      const record = await getOrCreateCredits(email, env.INTAKE_KV);
      remaining = creditsRemaining(record);
    }
  }

  // ── Emails ─────────────────────────────────────────────────────────────────
  let teamEmailSent = false;
  let clientEmailSent = false;

  const canEmail = !!(env.RESEND_API_KEY && env.NOTIFY_EMAIL && env.FROM_EMAIL);
  if (canEmail) {
    const headers = {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    };

    const teamHtml = teamEmailHtml(
      context.intakeData,
      enhancement,
      context.validation,
      context.iterationCount,
    );

    const clientHtml = email
      ? clientEmailHtml(context.intakeData, enhancement, remaining)
      : null;

    const [teamResult, clientResult] = await Promise.allSettled([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers,
        body: JSON.stringify({
          from: env.FROM_EMAIL,
          to: env.NOTIFY_EMAIL,
          subject: `🔥 New Lead: ${context.intakeData.business.businessName}${context.iterationCount > 0 ? ` (Rev #${context.iterationCount})` : ""}`,
          html: teamHtml,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r;
      }),

      clientHtml
        ? fetch("https://api.resend.com/emails", {
            method: "POST",
            headers,
            body: JSON.stringify({
              from: env.FROM_EMAIL,
              to: email,
              subject: `Your Zontak brief for ${context.intakeData.business.businessName} is ready ✓`,
              html: clientHtml,
            }),
          }).then(async (r) => {
            if (!r.ok) throw new Error(await r.text());
            return r;
          })
        : Promise.resolve(null),
    ]);

    teamEmailSent = teamResult.status === "fulfilled";
    clientEmailSent = clientResult.status === "fulfilled";

    if (!teamEmailSent) {
      console.error("Team email failed:", (teamResult as PromiseRejectedResult).reason);
    }
    if (!clientEmailSent && clientHtml) {
      console.error("Client email failed:", (clientResult as PromiseRejectedResult).reason);
    }
  } else {
    console.warn("Email env vars not configured — skipping email notifications");
  }

  return { teamEmailSent, clientEmailSent, creditsRemaining: remaining, edge: "done" };
}

/* ─── Helpers ─── */

function applyOutput(
  context: SessionContext,
  nodeId: NodeId,
  output: AssessOutput | GenerateOutput | ValidateOutput,
): void {
  switch (nodeId) {
    case "assess":
      context.assessment = output as AssessOutput;
      break;
    case "generate":
      context.enhancement = output as GenerateOutput;
      break;
    case "validate":
      context.validation = output as ValidateOutput;
      break;
  }
}

async function callClaude(systemPrompt: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-7-sonnet-latest",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: systemPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  return data.content?.[0]?.text ?? "";
}

function buildResult(state: ExecutionState): GraphResult {
  const delivery = state.context.delivery;
  return {
    sessionId: state.sessionId,
    status: state.status,
    enhancement: state.context.enhancement,
    validationScore: state.context.validation?.overallScore,
    creditsRemaining: delivery?.creditsRemaining,
    history: state.history,
  };
}
