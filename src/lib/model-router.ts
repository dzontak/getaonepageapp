/**
 * Intelligent per-node model routing for the Attractor pipeline.
 *
 * Routes each graph node to the most cost-efficient Claude model that can
 * handle its task successfully. Uses the ZONTAK.AI classifier framework:
 *
 *   Dimension scoring (1-5):
 *     - Complexity:        How many steps or considerations?
 *     - Reasoning Depth:   Inference/judgment vs pattern matching?
 *     - Domain Specificity: Specialized knowledge needed?
 *     - Ambiguity:         Clear instructions vs open-ended?
 *     - Stakes:            Cost of a mediocre answer?
 *
 *   Routing thresholds:
 *     Average 1.0–2.0 → HAIKU
 *     Average 2.1–3.5 → SONNET
 *     Average 3.6–5.0 → OPUS
 *     Any single dimension = 5 → upgrade one tier
 */

/* ─── Model Definitions ─── */

export type ModelTier = "haiku" | "sonnet" | "opus";

/** Anthropic API model IDs */
export const MODEL_IDS: Record<ModelTier, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-20250514",
  opus: "claude-opus-4-20250514",
};

/* ─── Classification Schema ─── */

export interface NodeClassification {
  model: ModelTier;
  modelId: string;
  confidence: number;
  scores: {
    complexity: number;
    reasoning_depth: number;
    domain_specificity: number;
    ambiguity: number;
    stakes: number;
  };
  average: number;
  reasoning: string;
}

/* ─── Per-Node Classifications ─── */

/**
 * Static classifications for each LLM node in the pipeline.
 *
 * These are pre-computed using the classifier framework rather than
 * calling an LLM to classify at runtime (which would add latency + cost).
 * The classifications are revisited when node prompts change materially.
 */
const NODE_CLASSIFICATIONS: Record<string, NodeClassification> = {

  assess: {
    model: "haiku",
    modelId: MODEL_IDS.haiku,
    confidence: 0.95,
    scores: {
      complexity: 2,        // Evaluate 5 checklist items
      reasoning_depth: 2,   // Pattern matching against criteria
      domain_specificity: 2, // General business brief knowledge
      ambiguity: 1,         // Clear instructions, rigid output schema
      stakes: 1,            // Advisory only — doesn't block pipeline
    },
    average: 1.6,
    reasoning: "Assessment is a checklist evaluation with rigid JSON output. Low stakes since it's advisory-only (always routes forward). Haiku handles structured scoring well.",
  },

  generate: {
    model: "sonnet",
    modelId: MODEL_IDS.sonnet,
    confidence: 0.85,
    scores: {
      complexity: 3,        // Dual output: polished prose + structured spec
      reasoning_depth: 3,   // Needs to infer missing details, write persuasive copy
      domain_specificity: 3, // Web strategy + copywriting knowledge
      ambiguity: 3,         // Must fill gaps in vague briefs
      stakes: 4,            // Core output that clients see — quality matters
    },
    average: 3.2,
    reasoning: "Generate requires creative writing, gap-filling, and structured site architecture in a single call. Stakes are high since this is the client-visible output. Sonnet balances quality and cost.",
  },

  validate: {
    model: "haiku",
    modelId: MODEL_IDS.haiku,
    confidence: 0.80,
    scores: {
      complexity: 2,        // Score 4 dimensions, compute average
      reasoning_depth: 3,   // Judgment on quality dimensions
      domain_specificity: 2, // General web quality assessment
      ambiguity: 1,         // Clear rubric, rigid output schema
      stakes: 3,            // Gates retry loop — but circuit breaker limits damage
    },
    average: 2.2,
    reasoning: "Validation is structured scoring against a clear rubric. The circuit breaker (max 2 attempts) limits the cost of a wrong score. Haiku can handle dimensional scoring with the detailed rubric provided.",
  },

  build: {
    model: "sonnet",
    modelId: MODEL_IDS.sonnet,
    confidence: 0.85,
    scores: {
      complexity: 5,        // Full HTML+CSS page, responsive, accessible, animated
      reasoning_depth: 4,   // Design decisions, layout choices, CSS architecture
      domain_specificity: 4, // Front-end development, responsive design, accessibility
      ambiguity: 3,         // Spec provides structure but visual design is open
      stakes: 5,            // THIS IS THE PRODUCT — customer sees the result directly
    },
    average: 4.2,
    reasoning: "Build is the highest-stakes node but must fit within a 60s serverless timeout. Opus (72s observed) is too slow. Sonnet produces quality HTML+CSS and completes in ~25-35s. The build_validate gate catches quality regressions, and email-only fallback limits risk.",
  },

  build_validate: {
    model: "haiku",
    modelId: MODEL_IDS.haiku,
    confidence: 0.80,
    scores: {
      complexity: 3,        // Review HTML structure, CSS, accessibility, branding
      reasoning_depth: 3,   // Judge quality across 4 dimensions
      domain_specificity: 3, // HTML/CSS/a11y knowledge
      ambiguity: 2,         // Clear rubric, concrete HTML to review
      stakes: 3,            // Gates deployment but has fallback to email-only
    },
    average: 2.8,
    reasoning: "Build validation scores HTML against a concrete rubric. While it needs some front-end knowledge, the rubric is explicit and the fallback (email-only delivery) limits the stakes. Haiku with the detailed prompt can handle this.",
  },
};

/* ─── Public API ─── */

/**
 * Get the classification (and model ID) for a given LLM node.
 * Falls back to Sonnet if the node isn't in the classification map.
 */
export function getNodeModel(nodeId: string): NodeClassification {
  return NODE_CLASSIFICATIONS[nodeId] ?? {
    model: "sonnet" as ModelTier,
    modelId: MODEL_IDS.sonnet,
    confidence: 0.5,
    scores: { complexity: 3, reasoning_depth: 3, domain_specificity: 3, ambiguity: 3, stakes: 3 },
    average: 3.0,
    reasoning: `Unknown node "${nodeId}" — defaulting to Sonnet for safety.`,
  };
}

/**
 * Get just the Anthropic API model ID for a node.
 * Convenience shorthand for the most common use case.
 */
export function getModelId(nodeId: string): string {
  return getNodeModel(nodeId).modelId;
}

/**
 * Get the full classification table (useful for logging/observability).
 */
export function getAllClassifications(): Record<string, NodeClassification> {
  return { ...NODE_CLASSIFICATIONS };
}
