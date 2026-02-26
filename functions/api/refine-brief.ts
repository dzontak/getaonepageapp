/**
 * Cloudflare Pages Function: POST /api/refine-brief
 *
 * Receives a plain-text project brief, sends it to the Anthropic API,
 * and returns a structured { refinedBrief, siteSpec } JSON response.
 *
 * Type definitions are inlined here because Workers bundle independently
 * from Next.js and cannot resolve the src/ path aliases. Keep these in
 * sync with src/agents/project-intake/types.ts → AiEnhancement / SiteSpec.
 */

interface SiteSection {
  sectionName: string;
  purpose: string;
  suggestedContent: string;
}

interface SiteSpec {
  headline: string;
  subheadline: string;
  seoDescription: string;
  sections: SiteSection[];
}

interface AiEnhancement {
  refinedBrief: string;
  siteSpec: SiteSpec;
}

interface Env {
  ANTHROPIC_API_KEY: string;
}

const SYSTEM_PROMPT = `You are a professional web strategist and copywriter for a one-page app agency. Given a raw project brief from a client intake form, do two things in one response:

1. Rewrite the brief as polished, client-ready prose (2-3 paragraphs). Keep it warm and professional. Reference specific details from the form.

2. Generate a structured site specification for a one-page website.

You MUST respond with ONLY valid JSON — no markdown, no code fences, no explanation — matching this exact schema:
{
  "refinedBrief": "string",
  "siteSpec": {
    "headline": "string (5-10 words, compelling hook for the hero section)",
    "subheadline": "string (1-2 sentences expanding the headline)",
    "seoDescription": "string (max 160 characters for meta description)",
    "sections": [
      {
        "sectionName": "string (e.g. Hero, About, Services, Gallery, Testimonials, Contact)",
        "purpose": "string (1 sentence describing what this section achieves)",
        "suggestedContent": "string (2-4 sentences of specific, actionable content suggestions)"
      }
    ]
  }
}

Include 4-7 sections in the siteSpec. The sections should flow logically for a one-page website.`;

export async function onRequestPost(context: EventContext<Env, string, unknown>): Promise<Response> {
  const { request, env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  let brief: string;
  try {
    const body = await request.json() as { brief?: unknown };
    if (typeof body.brief !== "string" || !body.brief.trim()) {
      return Response.json({ error: "Missing or invalid 'brief' field" }, { status: 400 });
    }
    brief = body.brief.trim();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-7-sonnet-latest",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the client's project brief:\n\n${brief}`,
        },
      ],
    }),
  });

  if (!anthropicResponse.ok) {
    const errorText = await anthropicResponse.text();
    console.error("Anthropic API error:", anthropicResponse.status, errorText);
    return Response.json(
      { error: "Failed to get AI response. Please try again." },
      { status: 502 },
    );
  }

  const anthropicData = await anthropicResponse.json() as {
    content: Array<{ type: string; text: string }>;
  };

  const rawText = anthropicData.content?.[0]?.text ?? "";

  let enhancement: AiEnhancement;
  try {
    // Strip any accidental markdown fences before parsing
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    enhancement = JSON.parse(cleaned) as AiEnhancement;
  } catch {
    console.error("Failed to parse Claude response as JSON:", rawText.slice(0, 200));
    return Response.json(
      { error: "AI returned an unexpected format. Please try again." },
      { status: 502 },
    );
  }

  return Response.json(enhancement, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequestGet(): Promise<Response> {
  return Response.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}
