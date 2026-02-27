/**
 * POST /api/refine-brief
 *
 * Single-shot Claude call: receives a plain-text project brief and returns
 * a structured { refinedBrief, siteSpec } response.
 *
 * Used by the "Refine with AI" button in the intake form for on-demand
 * polish before the full agentic submission flow.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY — Anthropic API key
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  let brief: string;
  try {
    const body = await request.json() as { brief?: unknown };
    if (typeof body.brief !== "string" || !body.brief.trim()) {
      return NextResponse.json({ error: "Missing or invalid 'brief' field" }, { status: 400 });
    }
    brief = body.brief.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
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
    return NextResponse.json(
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
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    enhancement = JSON.parse(cleaned) as AiEnhancement;
  } catch {
    console.error("Failed to parse Claude response as JSON:", rawText.slice(0, 200));
    return NextResponse.json(
      { error: "AI returned an unexpected format. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json(enhancement, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}
