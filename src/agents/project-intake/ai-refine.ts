import type { AiEnhancement } from "./types";

/**
 * Sends the plain-text project brief to the Cloudflare Pages Function
 * at /api/refine-brief, which calls the Anthropic API and returns a
 * structured { refinedBrief, siteSpec } response.
 */
export async function refineWithClaude(
  plainTextBrief: string,
): Promise<AiEnhancement> {
  const response = await fetch("/api/refine-brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief: plainTextBrief }),
  });

  if (!response.ok) {
    let message = `Server error (${response.status})`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // use default message
    }
    throw new Error(message);
  }

  const data = await response.json() as AiEnhancement;
  return data;
}
