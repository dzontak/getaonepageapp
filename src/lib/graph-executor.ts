/**
 * Attractor execution engine.
 *
 * Implements the four core properties:
 *   Deterministic — same inputs produce the same graph traversal
 *   Observable    — every node transition is logged with timestamp + duration
 *   Resumable     — state is persisted to KV after every transition
 *   Composable    — executeGraph() is a pure async function; embeddable in larger graphs
 *
 * Graph topology (8 nodes):
 *   assess → generate → validate → sanity_check → build → build_validate → deploy → deliver
 *                  ↑         │ (needs_revision, attempts < 2)
 *                  └─────────┘
 *
 * Sanity_check gates the auto-build pipeline. If it fails, or if any build/deploy
 * node fails, the pipeline falls back to email-only delivery (graceful degradation).
 */

import type {
  ExecutionState,
  SessionContext,
  NodeId,
  EdgeLabel,
  NodeTransition,
  NodeOutput,
  GraphResult,
  AssessOutput,
  GenerateOutput,
  ValidateOutput,
  SanityCheckOutput,
  BuildOutput,
  BuildValidateOutput,
  DeployOutput,
} from "./graph-types";
import {
  saveSession,
  getOrCreateCredits,
  deductCredit,
  creditsRemaining,
  type KVStore,
} from "./graph-state";
import {
  NODE_PROMPTS,
  parseAssessOutput,
  parseGenerateOutput,
  parseValidateOutput,
  parseBuildOutput,
  parseBuildValidateOutput,
  evaluateSanityCheck,
} from "./graph-nodes";
import { teamEmailHtml, clientEmailHtml } from "./email-templates";
import { deployToCloudflare } from "./cloudflare-deploy";
import { getModelId } from "./model-router";

/* ─── Environment Interface ─── */

export interface GraphEnv {
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY?: string;
  NOTIFY_EMAIL?: string;
  FROM_EMAIL?: string;
  INTAKE_KV?: KVStore;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
}

/* ─── Constants ─── */

const MAX_GENERATE_ATTEMPTS = 2;   // 1 initial + 1 retry on validation failure
const VALIDATE_PASS_THRESHOLD = 7; // out of 10
const BUILD_VALIDATE_THRESHOLD = 7;
const BUILD_MAX_TOKENS = 8192;     // enough for a one-page site, fits 60s Vercel timeout

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
): Promise<{ output: NodeOutput; nextNode: NodeId; edge: EdgeLabel }> {

  switch (nodeId) {
    /* ── Original nodes ────────────────────────────────────────────────────── */

    case "assess": {
      const prompt = NODE_PROMPTS.assess(context);
      const rawText = await callClaude(prompt, env.ANTHROPIC_API_KEY, getModelId("assess"));
      const output = parseAssessOutput(rawText);
      return { output, nextNode: "generate", edge: "proceed" };
    }

    case "generate": {
      context.generateAttempts += 1;
      const prompt = NODE_PROMPTS.generate(context);
      const rawText = await callClaude(prompt, env.ANTHROPIC_API_KEY, getModelId("generate"));
      const output = parseGenerateOutput(rawText);
      return { output, nextNode: "validate", edge: "generated" };
    }

    case "validate": {
      const prompt = NODE_PROMPTS.validate(context);
      const rawText = await callClaude(prompt, env.ANTHROPIC_API_KEY, getModelId("validate"));
      const output = parseValidateOutput(rawText);
      const canRetry = context.generateAttempts < MAX_GENERATE_ATTEMPTS;

      if (output.overallScore >= VALIDATE_PASS_THRESHOLD) {
        // Route to sanity_check instead of deliver
        return { output, nextNode: "sanity_check", edge: "passes" };
      } else if (canRetry) {
        return { output, nextNode: "generate", edge: "needs_revision" };
      } else {
        // Circuit breaker: route to sanity_check (may still attempt build)
        return { output, nextNode: "sanity_check", edge: "max_retries" };
      }
    }

    /* ── New auto-build pipeline nodes ─────────────────────────────────────── */

    case "sanity_check": {
      // Procedural — no LLM call
      const output = evaluateSanityCheck(context);
      const nextNode: NodeId = output.qualifies ? "build" : "deliver";
      return { output, nextNode, edge: output.edge };
    }

    case "build": {
      try {
        const prompt = NODE_PROMPTS.build(context);
        const rawText = await callClaude(prompt, env.ANTHROPIC_API_KEY, getModelId("build"), BUILD_MAX_TOKENS);
        const output = parseBuildOutput(rawText);
        return { output, nextNode: "build_validate", edge: "built" };
      } catch (err) {
        console.error("Build node failed:", err);
        // Graceful degradation: skip to deliver (email-only)
        const fallback: BuildOutput = {
          html: "",
          buildNotes: `Build failed: ${err instanceof Error ? err.message : String(err)}`,
          edge: "built",
        };
        context.build = fallback;
        return { output: fallback, nextNode: "deliver", edge: "build_failed" };
      }
    }

    case "build_validate": {
      try {
        const prompt = NODE_PROMPTS.build_validate(context);
        const rawText = await callClaude(prompt, env.ANTHROPIC_API_KEY, getModelId("build_validate"));
        const output = parseBuildValidateOutput(rawText);

        if (output.overallScore >= BUILD_VALIDATE_THRESHOLD) {
          return { output, nextNode: "deploy", edge: "html_passes" };
        } else {
          // No retry loop — fall back to email-only delivery
          return { output, nextNode: "deliver", edge: "html_fails" };
        }
      } catch (err) {
        console.error("Build validate failed:", err);
        const fallback: BuildValidateOutput = {
          scores: { structuralIntegrity: 0, responsiveness: 0, accessibility: 0, brandAlignment: 0 },
          overallScore: 0,
          issues: [`Validation error: ${err instanceof Error ? err.message : String(err)}`],
          edge: "html_fails",
        };
        return { output: fallback, nextNode: "deliver", edge: "html_fails" };
      }
    }

    case "deploy": {
      // Check for Cloudflare env vars
      if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
        console.warn("Cloudflare env vars not configured — skipping deployment");
        const fallback: DeployOutput = {
          projectName: "",
          deploymentUrl: "",
          deploymentId: "",
          edge: "deployed",
        };
        return { output: fallback, nextNode: "deliver", edge: "deploy_failed" };
      }

      try {
        const result = await deployToCloudflare(
          context.intakeData.business.businessName,
          context.build!.html,
          {
            CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
            CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
          },
        );

        const output: DeployOutput = {
          projectName: result.projectName,
          deploymentUrl: result.deploymentUrl,
          deploymentId: result.deploymentId,
          edge: "deployed",
        };
        return { output, nextNode: "deliver", edge: "deployed" };
      } catch (err) {
        console.error("Deploy to Cloudflare failed:", err);
        const fallback: DeployOutput = {
          projectName: "",
          deploymentUrl: "",
          deploymentId: "",
          edge: "deployed",
        };
        return { output: fallback, nextNode: "deliver", edge: "deploy_failed" };
      }
    }
  }
}

/* ─── Deliver Node (procedural — no LLM call) ─── */

async function executeDeliverNode(
  context: SessionContext,
  env: GraphEnv,
): Promise<{ teamEmailSent: boolean; clientEmailSent: boolean; creditsRemaining: number; siteUrl?: string; edge: "done" }> {
  const email = context.intakeData.contact.email;
  const enhancement = context.enhancement;

  if (!enhancement) {
    throw new Error("Cannot deliver: no enhancement output from generate node");
  }

  // Determine if we have a live site URL
  const siteUrl = context.deployment?.deploymentUrl || undefined;

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
      siteUrl,
    );

    const clientHtml = email
      ? clientEmailHtml(context.intakeData, enhancement, remaining, siteUrl)
      : null;

    // Subject lines change based on whether the site was auto-built
    const teamSubject = siteUrl
      ? `🚀 Auto-Built: ${context.intakeData.business.businessName}${context.iterationCount > 0 ? ` (Rev #${context.iterationCount})` : ""}`
      : `🔥 New Lead: ${context.intakeData.business.businessName}${context.iterationCount > 0 ? ` (Rev #${context.iterationCount})` : ""}`;

    const clientSubject = siteUrl
      ? `Your site for ${context.intakeData.business.businessName} is live!`
      : `Your Zontak brief for ${context.intakeData.business.businessName} is ready ✓`;

    const [teamResult, clientResult] = await Promise.allSettled([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers,
        body: JSON.stringify({
          from: env.FROM_EMAIL,
          to: env.NOTIFY_EMAIL,
          subject: teamSubject,
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
              subject: clientSubject,
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

  return { teamEmailSent, clientEmailSent, creditsRemaining: remaining, siteUrl, edge: "done" };
}

/* ─── Helpers ─── */

function applyOutput(
  context: SessionContext,
  nodeId: NodeId,
  output: NodeOutput,
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
    case "sanity_check":
      context.sanityCheck = output as SanityCheckOutput;
      break;
    case "build":
      context.build = output as BuildOutput;
      break;
    case "build_validate":
      context.buildValidation = output as BuildValidateOutput;
      break;
    case "deploy":
      context.deployment = output as DeployOutput;
      break;
  }
}

async function callClaude(
  systemPrompt: string,
  apiKey: string,
  model: string,
  maxTokens: number = 4096,
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
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
    siteUrl: state.context.deployment?.deploymentUrl || undefined,
    history: state.history,
  };
}
