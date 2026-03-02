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
 *
 * Procedural nodes (sanity_check, deploy, deliver) have no prompts —
 * they are executed directly in graph-executor.ts.
 */

import type {
  NodeId,
  AssessOutput,
  GenerateOutput,
  ValidateOutput,
  SanityCheckOutput,
  BuildOutput,
  BuildValidateOutput,
  SessionContext,
} from "./graph-types";
import { resolveColors } from "./site-builder";

/* ─── LLM Node IDs (nodes that call Claude) ─── */

type LlmNodeId = "assess" | "generate" | "validate" | "build" | "build_validate";

/* ─── Node Governing Prompts ─── */

export const NODE_PROMPTS: Record<LlmNodeId, (ctx: SessionContext) => string> = {

  assess: (ctx) => `You are evaluating a client's intake brief for a one-page website build.

Here is the client's brief:
---
${ctx.plainText}
---

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
Here is the client's project brief:
---
${ctx.plainText}
---

Given this brief, produce two outputs:

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

  /* ─── New Build Node ─── */

  build: (ctx) => {
    const spec = ctx.enhancement!.siteSpec;
    const style = ctx.intakeData.style;
    const business = ctx.intakeData.business;
    const project = ctx.intakeData.project;
    const contact = ctx.intakeData.contact;
    const colors = resolveColors(style);

    const sectionsBlock = spec.sections
      .map(
        (s, i) =>
          `Section ${i + 1}: "${s.sectionName}"
  Purpose: ${s.purpose}
  Content: ${s.suggestedContent}`,
      )
      .join("\n\n");

    return `You are an expert front-end developer building a complete, production-ready single-page website.

BUSINESS CONTEXT:
- Business: ${business.businessName}
- Type: ${business.businessType}
- Industry: ${business.industry || "General"}
- CTA: ${project.callToAction}
- Style: ${style.stylePreset} preset
- Style Notes: ${style.styleNotes || "None"}
${contact.email ? `- Contact Email: ${contact.email}` : ""}
${contact.phone ? `- Phone: ${contact.phone}` : ""}

DESIGN SYSTEM:
- Primary Color: ${colors.primary}
- Secondary Color: ${colors.secondary}
- Background Color: ${colors.background}
- Text Color: ${colors.text}
- Text Light: ${colors.textLight}
- Font: Use system font stack (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)

HEADLINE: ${spec.headline}
SUBHEADLINE: ${spec.subheadline}
SEO DESCRIPTION: ${spec.seoDescription}

SECTIONS TO BUILD:
${sectionsBlock}

REQUIREMENTS:
1. Output a COMPLETE, VALID HTML file with embedded CSS in a <style> tag. No external dependencies, no JavaScript frameworks, no CDN links.
2. The page must be FULLY RESPONSIVE (mobile-first, looks great on 375px-1440px).
3. Use semantic HTML5 (header, nav, main, section, footer).
4. Each section from the spec becomes an HTML <section> with an id (kebab-case of sectionName).
5. Include a sticky navigation bar with smooth-scroll anchor links to each section.
6. The hero section should be visually striking with the headline and subheadline.
7. Include a clear, prominent CTA button styled with the primary color.
8. Add a footer with the business name, copyright year 2025, and contact info if provided.
9. Include proper <meta> tags: charset, viewport, description, og:title, og:description.
10. Use CSS custom properties (variables) for the color system.
11. Add subtle CSS animations (fade-in on scroll using @keyframes, no JS required).
12. Include hover effects on interactive elements.
13. Ensure text colors have good contrast against their backgrounds.
14. The <title> should be "${business.businessName} — ${spec.headline}".
15. Use only minimal JavaScript for smooth scrolling and mobile nav toggle (no libraries).
16. The CSS should include a print-friendly @media print block that hides nav and shows content.

Respond with ONLY valid JSON — no markdown, no code fences:
{
  "html": "<!DOCTYPE html>...(the complete HTML file as a single escaped JSON string)...",
  "buildNotes": "string (2-3 sentences about design choices made)",
  "edge": "built"
}

CRITICAL: The "html" field must contain the COMPLETE HTML document as a single escaped JSON string. Every quote inside the HTML must be escaped. The file must render correctly when saved as index.html and opened in a browser.`;
  },

  /* ─── New Build Validate Node ─── */

  build_validate: (ctx) => {
    const html = ctx.build!.html;
    const spec = ctx.enhancement!.siteSpec;
    const style = ctx.intakeData.style;

    // Truncate HTML if very long to stay within context limits
    const htmlPreview =
      html.length > 12000
        ? html.slice(0, 12000) + "\n... (truncated for review)"
        : html;

    return `You are a QA engineer reviewing a generated HTML+CSS single-page website.

EXPECTED SITE SPEC:
- Headline: ${spec.headline}
- Subheadline: ${spec.subheadline}
- Expected sections: ${spec.sections.map((s) => s.sectionName).join(", ")}
- Style preset: ${style.stylePreset}
- Primary color: ${style.primaryColor || "(from preset)"}

HTML TO REVIEW:
${htmlPreview}

Score each dimension 1–10:
- structuralIntegrity: Valid HTML5, properly nested tags, no unclosed elements, proper DOCTYPE + head + body structure
- responsiveness: Mobile-first CSS, media queries for breakpoints, flexible layouts (no fixed pixel widths for content)
- accessibility: Semantic HTML elements, sufficient color contrast, ARIA labels on navigation
- brandAlignment: Uses the specified colors, headline/subheadline match the spec, all requested sections are present

Overall score = average of all four dimensions.
- overall >= 7 → edge: "html_passes"
- overall < 7  → edge: "html_fails"

Respond with ONLY valid JSON — no markdown, no explanation:
{
  "scores": {
    "structuralIntegrity": number,
    "responsiveness": number,
    "accessibility": number,
    "brandAlignment": number
  },
  "overallScore": number,
  "issues": string[],
  "edge": "html_passes" | "html_fails"
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
    to: "sanity_check",
  },
  {
    from: "validate",
    condition: "Overall score < 7 AND generate attempts < 2 — revise with critique",
    to: "generate",
  },
  {
    from: "validate",
    condition: "Overall score < 7 AND generate attempts >= 2 — force delivery of best effort",
    to: "sanity_check",
  },
  {
    from: "sanity_check",
    condition: "Submission qualifies for auto-build (score >= 6, valid spec, valid style)",
    to: "build",
  },
  {
    from: "sanity_check",
    condition: "Submission does not qualify — fall back to email-only delivery",
    to: "deliver",
  },
  {
    from: "build",
    condition: "HTML page generated successfully",
    to: "build_validate",
  },
  {
    from: "build",
    condition: "Build failed (Claude API error, invalid output) — graceful degradation",
    to: "deliver",
  },
  {
    from: "build_validate",
    condition: "HTML quality score >= 7 — ready for deployment",
    to: "deploy",
  },
  {
    from: "build_validate",
    condition: "HTML quality score < 7 — fall back to email-only delivery",
    to: "deliver",
  },
  {
    from: "deploy",
    condition: "Deployment to Cloudflare Pages succeeded",
    to: "deliver",
  },
  {
    from: "deploy",
    condition: "Deployment failed — fall back to email-only delivery",
    to: "deliver",
  },
];

/* ─── Sanity Check (procedural, no LLM) ─── */

const VALID_PRESETS = ["warm", "cool", "bold", "earth", "minimal", "custom"];
const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const SANITY_SCORE_THRESHOLD = 6;
const MIN_SECTIONS = 3;

/**
 * Evaluate whether a submission qualifies for the auto-build pipeline.
 * Criteria are intentionally lenient — we'd rather build and let build_validate
 * catch quality issues than reject a paying customer.
 */
export function evaluateSanityCheck(ctx: SessionContext): SanityCheckOutput {
  const reasons: string[] = [];
  let qualifies = true;

  const spec = ctx.enhancement?.siteSpec;
  const style = ctx.intakeData.style;
  const validation = ctx.validation;

  // 1. Must have a siteSpec with enough sections
  if (!spec || spec.sections.length < MIN_SECTIONS) {
    qualifies = false;
    reasons.push(
      `Site spec has ${spec?.sections.length ?? 0} sections (minimum ${MIN_SECTIONS})`,
    );
  }

  // 2. Must have headline and subheadline
  if (!spec?.headline?.trim() || !spec?.subheadline?.trim()) {
    qualifies = false;
    reasons.push("Missing headline or subheadline in site spec");
  }

  // 3. Validation score must be at or above threshold
  if (validation && validation.overallScore < SANITY_SCORE_THRESHOLD) {
    qualifies = false;
    reasons.push(
      `Validation score ${validation.overallScore.toFixed(1)} is below auto-build threshold of ${SANITY_SCORE_THRESHOLD}`,
    );
  }

  // 4. Must have a recognized style preset
  if (!VALID_PRESETS.includes(style.stylePreset)) {
    qualifies = false;
    reasons.push(`Unrecognized style preset: "${style.stylePreset}"`);
  }

  // 5. If custom preset, must have valid hex colors
  if (style.stylePreset === "custom") {
    if (!HEX_REGEX.test(style.primaryColor) || !HEX_REGEX.test(style.secondaryColor)) {
      qualifies = false;
      reasons.push("Custom colors are not valid hex values (#RRGGBB)");
    }
  }

  // 6. Business name must exist (used for Cloudflare project slug)
  if (!ctx.intakeData.business.businessName?.trim()) {
    qualifies = false;
    reasons.push("Missing business name (required for deployment)");
  }

  if (qualifies) {
    reasons.push("All criteria met for auto-build");
  }

  return {
    qualifies,
    reasons,
    edge: qualifies ? "auto_build" : "skip_build",
  };
}

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

export function parseBuildOutput(raw: string): BuildOutput {
  const cleaned = stripCodeFences(raw);
  const parsed = JSON.parse(cleaned) as BuildOutput;
  if (parsed.edge !== "built") parsed.edge = "built"; // enforce

  // Validate that html field contains something meaningful
  if (!parsed.html || !parsed.html.includes("<!DOCTYPE") && !parsed.html.includes("<html")) {
    throw new Error("Build output missing valid HTML document");
  }

  return parsed;
}

export function parseBuildValidateOutput(raw: string): BuildValidateOutput {
  const cleaned = stripCodeFences(raw);
  const parsed = JSON.parse(cleaned) as BuildValidateOutput;
  // Recompute overallScore defensively
  const { structuralIntegrity, responsiveness, accessibility, brandAlignment } = parsed.scores;
  parsed.overallScore =
    (structuralIntegrity + responsiveness + accessibility + brandAlignment) / 4;
  return parsed;
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}
