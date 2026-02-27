/**
 * Attractor graph definition.
 *
 * Each node has:
 *   - id: unique NodeId
 *   - description: human-readable purpose
 *   - governingPrompt: the instruction given to the LLM for this node
 *   - outputSchema: JSON schema embedded in the prompt for structured output
 *   - edges: available transitions with natural-language conditions
 *
 * The LLM evaluates which edge to take by embedding the edge label
 * directly in its structured JSON response — one API call per node.
 */

import type { NodeId, AssessOutput, GenerateOutput, ValidateOutput, SessionContext } from "./graph-types";

/* ─── Node Governing Prompts ─── */

export const NODE_PROMPTS: Record<Exclude<NodeId, "deliver">, (ctx: SessionContext) => string> = {

  assess: (_ctx) => `You are evaluating a client's intake brief for a one-page website build.

Assess the brief for completeness across these elements:
1. Clear call-to-action (what should visitors do when they land on the site?)
2. Business description (what does this business do?)
3. Target audience (who are the customers?)
4. Services or products offered
5. Contact or location information

Score the brief 1–10 for overall quality. List any missing or weak elements.

Always set "edge" to "proceed" — quality issues are informational context for the next stage,
not blockers. The brief will be enhanced regardless.

Respond with ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "qualityScore": number,
  "missingElements": string[],
  "qualityNotes": string,
  "edge": "proceed"
}`,

  generate: (ctx) => {
    const assessmentContext = ctx.assessment
      ? `\nQuality assessment from the intake review:
Score: ${ctx.assessment.qualityScore}/10
Missing elements: ${ctx.assessment.missingElements.length > 0 ? ctx.assessment.missingElements.join(", ") : "none"}
Notes: ${ctx.assessment.qualityNotes}

Address any gaps in your output — infer reasonable details for anything that's missing.\n`
      : "";

    const retryContext = ctx.validation && ctx.generateAttempts > 1
      ? `\nThis is a revision attempt. The previous spec was scored ${ctx.validation.overallScore}/10.
Critique: ${ctx.validation.critique}
Specific improvements needed:
${ctx.validation.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n`
      : "";

    return `You are a professional web strategist and copywriter for a one-page app agency.
${assessmentContext}${retryContext}
Given the client's project brief, produce two outputs:

1. Rewrite the brief as polished, client-ready prose (2–3 paragraphs). Warm, professional tone.
   Reference specific details from the form. Fill in reasonable gaps with confident copy.

2. Generate a structured site specification for a one-page website with 4–7 sections.
   Sections should flow logically: hook → trust → offer → proof → action.

Respond with ONLY valid JSON — no markdown, no code fences, no explanation:
{
  "refinedBrief": "string",
  "siteSpec": {
    "headline": "string (5–10 words, compelling hook for the hero section)",
    "subheadline": "string (1–2 sentences expanding the headline)",
    "seoDescription": "string (max 160 characters for meta description)",
    "sections": [
      {
        "sectionName": "string",
        "purpose": "string (one sentence)",
        "suggestedContent": "string (2–4 sentences of specific, actionable content)"
      }
    ]
  },
  "edge": "generated"
}`;
  },

  validate: (ctx) => {
    const spec = ctx.enhancement?.siteSpec;
    const brief = ctx.enhancement?.refinedBrief ?? "";

    return `You are a quality assurance agent reviewing a one-page website specification.

Score each dimension 1–10:
- clarity:       Is the messaging immediately clear to a first-time visitor?
- completeness:  Are all sections necessary for this business type present?
- ctaStrength:   Is the primary call-to-action specific, compelling, and actionable?
- sectionFlow:   Do the sections build a logical narrative that earns the conversion?

Overall score = average of all four. Apply these routing rules:
- overall >= 7  → edge: "passes"
- overall < 7   → edge: "needs_revision" (provide specific critique and suggestions)

Site specification to review:
Headline: ${spec?.headline ?? ""}
Subheadline: ${spec?.subheadline ?? ""}
SEO: ${spec?.seoDescription ?? ""}
Sections: ${spec?.sections.map(s => s.sectionName).join(", ") ?? ""}

Polished brief:
${brief.slice(0, 500)}

Respond with ONLY valid JSON — no markdown, no explanation:
{
  "scores": {
    "clarity": number,
    "completeness": number,
    "ctaStrength": number,
    "sectionFlow": number
  },
  "overallScore": number,
  "critique": "string",
  "suggestions": string[],
  "edge": "passes" | "needs_revision"
}`;
  },
};

/* ─── Edge Definitions (for observability + documentation) ─── */

export interface EdgeDefinition {
  from: NodeId;
  condition: string;  // natural language description of when this edge fires
  to: NodeId;
}

export const GRAPH_EDGES: EdgeDefinition[] = [
  {
    from: "assess",
    condition: "Brief has been evaluated — proceed regardless of quality score",
    to: "generate",
  },
  {
    from: "generate",
    condition: "Spec has been generated — send to validation",
    to: "validate",
  },
  {
    from: "validate",
    condition: "Overall score >= 7 — spec meets quality threshold",
    to: "deliver",
  },
  {
    from: "validate",
    condition: "Overall score < 7 AND generate attempts < 2 — revise with critique",
    to: "generate",
  },
  {
    from: "validate",
    condition: "Overall score < 7 AND generate attempts >= 2 — deliver best effort",
    to: "deliver",
  },
];

/* ─── Node Output Parsers ─── */

export function parseAssessOutput(raw: string): AssessOutput {
  const cleaned = stripCodeFences(raw);
  const parsed = JSON.parse(cleaned) as AssessOutput;
  if (parsed.edge !== "proceed") parsed.edge = "proceed"; // enforce
  return parsed;
}

export function parseGenerateOutput(raw: string): GenerateOutput {
  const cleaned = stripCodeFences(raw);
  const parsed = JSON.parse(cleaned) as GenerateOutput;
  if (parsed.edge !== "generated") parsed.edge = "generated"; // enforce
  return parsed;
}

export function parseValidateOutput(raw: string): ValidateOutput {
  const cleaned = stripCodeFences(raw);
  const parsed = JSON.parse(cleaned) as ValidateOutput;
  // Recompute overallScore defensively
  const { clarity, completeness, ctaStrength, sectionFlow } = parsed.scores;
  parsed.overallScore = (clarity + completeness + ctaStrength + sectionFlow) / 4;
  return parsed;
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}
