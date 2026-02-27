import type { AiEnhancement, ProjectIntakeData } from "./types";

/* ─── Response shape from POST /api/submit-intake ─── */

export interface GraphNodeTransition {
  from: string;
  to: string;
  edge: string;
  timestamp: string;
  durationMs: number;
}

export interface GraphResult {
  sessionId: string;
  status: "completed" | "failed" | "running";
  enhancement?: AiEnhancement;
  validationScore?: number;
  creditsRemaining?: number;
  history: GraphNodeTransition[];
}

/**
 * Submits the full intake form to the Attractor graph execution endpoint.
 *
 * The server will:
 *   1. Run 4-node graph: assess → generate → validate → deliver
 *   2. Auto-refine the brief with Claude at the generate node
 *   3. Self-correct via the validate → generate feedback loop (max 1 retry)
 *   4. Email the Zontak team + the client at the deliver node
 *   5. Track iteration credits (first 3 revisions included per client)
 *
 * Returns the full GraphResult including the session ID, enhancement, validation
 * score, credits remaining, and the complete transition history.
 */
export async function submitIntake(
  data: ProjectIntakeData,
  plainText: string,
  iterationCount = 0,
): Promise<GraphResult> {
  const response = await fetch("/api/submit-intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, plainText, iterationCount }),
  });

  let result: GraphResult;
  try {
    result = await response.json() as GraphResult;
  } catch {
    throw new Error(`Server error (${response.status}): could not parse response`);
  }

  if (!response.ok) {
    const msg = (result as { error?: string }).error ?? `Server error (${response.status})`;
    throw new Error(msg);
  }

  return result;
}
