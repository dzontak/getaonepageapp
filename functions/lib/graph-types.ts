/**
 * Attractor execution model types.
 *
 * The graph has 4 nodes: assess → generate → validate → deliver
 * Validate can loop back to generate (max 2 attempts total) before forcing deliver.
 *
 * Each node's Claude response embeds the edge label so routing is deterministic
 * and derived from the same call that produced the output.
 */

import type { ProjectIntakeData, AiEnhancement, SiteSpec } from "./intake-types";

export type { ProjectIntakeData, AiEnhancement, SiteSpec };

/* ─── Graph Topology ─── */

export type NodeId = "assess" | "generate" | "validate" | "deliver";

export type EdgeLabel =
  | "proceed"         // assess → generate
  | "generated"       // generate → validate
  | "passes"          // validate → deliver
  | "needs_revision"  // validate → generate (retry)
  | "max_retries"     // validate → deliver (forced after 2 generate attempts)
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

/** deliver: email dispatch + credit management */
export interface DeliverOutput {
  teamEmailSent: boolean;
  clientEmailSent: boolean;
  creditsRemaining: number;
  edge: "done";
}

export type NodeOutput = AssessOutput | GenerateOutput | ValidateOutput | DeliverOutput;

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
