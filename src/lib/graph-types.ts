/**
 * Attractor execution model types.
 *
 * The graph has 8 nodes:
 *   assess → generate → validate → sanity_check → build → build_validate → deploy → deliver
 *
 * Validate can loop back to generate (max 2 attempts total) before routing to sanity_check.
 * Sanity_check gates the auto-build pipeline: qualifying submissions are built and deployed
 * to Cloudflare Pages; others fall back to the email-only delivery flow.
 *
 * Each LLM node's Claude response embeds the edge label so routing is deterministic
 * and derived from the same call that produced the output.
 */

import type { ProjectIntakeData, AiEnhancement, SiteSpec } from "./intake-types";

export type { ProjectIntakeData, AiEnhancement, SiteSpec };

/* ─── Graph Topology ─── */

export type NodeId =
  | "assess"
  | "generate"
  | "validate"
  | "sanity_check"
  | "build"
  | "build_validate"
  | "deploy"
  | "deliver";

export type EdgeLabel =
  | "proceed"         // assess → generate
  | "generated"       // generate → validate
  | "passes"          // validate → sanity_check
  | "needs_revision"  // validate → generate (retry)
  | "max_retries"     // validate → sanity_check (forced after 2 generate attempts)
  | "auto_build"      // sanity_check → build
  | "skip_build"      // sanity_check → deliver (fallback to email-only)
  | "built"           // build → build_validate
  | "build_failed"    // build → deliver (graceful degradation)
  | "html_passes"     // build_validate → deploy
  | "html_fails"      // build_validate → deliver (graceful degradation)
  | "deployed"        // deploy → deliver
  | "deploy_failed"   // deploy → deliver (graceful degradation)
  | "done";           // deliver → terminal

/* ─── Per-Node Output Schemas ─── */

/** assess: advisory quality check; always routes forward */
export interface AssessOutput {
  qualityScore: number;       // 1-10
  missingElements: string[];  // e.g. ["clear CTA", "target audience"]
  qualityNotes: string;       // injected as context into generate
  edge: "proceed";
}

/** generate: polished brief + site spec */
export interface GenerateOutput {
  refinedBrief: string;
  siteSpec: SiteSpec;
  edge: "generated";
}

/** validate: 4-dimension quality gate */
export interface ValidateOutput {
  scores: {
    clarity: number;       // Is messaging clear to a first-time visitor?
    completeness: number;  // Are all necessary sections present?
    ctaStrength: number;   // Is the primary CTA compelling and specific?
    sectionFlow: number;   // Do sections tell a logical narrative?
  };
  overallScore: number;    // average of the four scores
  critique: string;        // specific, actionable critique
  suggestions: string[];   // concrete improvement suggestions
  edge: "passes" | "needs_revision";
}

/** sanity_check: procedural gate deciding auto-build vs email-only */
export interface SanityCheckOutput {
  qualifies: boolean;
  reasons: string[];         // why it qualifies or doesn't
  edge: "auto_build" | "skip_build";
}

/** build: Claude-generated complete HTML+CSS page */
export interface BuildOutput {
  html: string;              // full <!DOCTYPE html>...</html>
  buildNotes: string;        // Claude's notes about design choices
  edge: "built";
}

/** build_validate: structural/quality check on the generated HTML */
export interface BuildValidateOutput {
  scores: {
    structuralIntegrity: number;  // valid HTML, no broken tags
    responsiveness: number;        // mobile-friendly CSS present
    accessibility: number;         // alt text, ARIA, semantic HTML
    brandAlignment: number;        // colors/style match the spec
  };
  overallScore: number;
  issues: string[];
  edge: "html_passes" | "html_fails";
}

/** deploy: Cloudflare Pages deployment result */
export interface DeployOutput {
  projectName: string;
  deploymentUrl: string;     // e.g. "https://sunrise-bakery.pages.dev"
  deploymentId: string;
  edge: "deployed";
}

/** deliver: email dispatch + credit management */
export interface DeliverOutput {
  teamEmailSent: boolean;
  clientEmailSent: boolean;
  creditsRemaining: number;
  siteUrl?: string;          // present if deployment succeeded
  edge: "done";
}

export type NodeOutput =
  | AssessOutput
  | GenerateOutput
  | ValidateOutput
  | SanityCheckOutput
  | BuildOutput
  | BuildValidateOutput
  | DeployOutput
  | DeliverOutput;

/* ─── Execution Context ─── */

/**
 * The accumulated context that flows through the graph.
 * Each node can read all previous outputs and adds its own.
 */
export interface SessionContext {
  intakeData: ProjectIntakeData;
  plainText: string;          // pre-formatted brief text (sent with form)

  // Accumulated node outputs (set as each node completes)
  assessment?: AssessOutput;
  enhancement?: GenerateOutput;
  validation?: ValidateOutput;
  sanityCheck?: SanityCheckOutput;
  build?: BuildOutput;
  buildValidation?: BuildValidateOutput;
  deployment?: DeployOutput;
  delivery?: DeliverOutput;

  // Loop control
  generateAttempts: number;   // circuit breaker: max 2
  iterationCount: number;     // 0 = first submission; >0 = revision (costs credit)
}

/* ─── Execution State (persisted in KV) ─── */

/** A single logged node transition — the Observable property of Attractor */
export interface NodeTransition {
  from: NodeId;
  to: NodeId;
  edge: EdgeLabel;
  timestamp: string;     // ISO 8601
  durationMs: number;    // wall-clock time for the node execution
}

export type SessionStatus = "running" | "completed" | "failed";

/**
 * Full execution state for one graph run.
 * Persisted to KV after every node transition — enables Resumable property.
 */
export interface ExecutionState {
  sessionId: string;
  currentNode: NodeId;
  context: SessionContext;
  history: NodeTransition[];   // complete audit trail
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

/* ─── Graph Result (returned to the browser) ─── */

export interface GraphResult {
  sessionId: string;
  status: SessionStatus;
  enhancement?: GenerateOutput;   // present when status === "completed"
  validationScore?: number;        // overallScore from validate node
  creditsRemaining?: number;
  siteUrl?: string;                // live site URL if auto-build + deploy succeeded
  history: NodeTransition[];       // full transition log for observability
}

/* ─── Credit System ─── */

export interface CreditRecord {
  email: string;
  total: number;    // credits allocated
  used: number;     // credits consumed
  plan: "standard";
  createdAt: string;
  updatedAt: string;
}

export const CREDITS_INCLUDED = 3;  // included with every $100/year subscription
export const CREDITS_KV_PREFIX = "credits:";
export const SESSION_KV_PREFIX = "session:";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;  // 30 days
