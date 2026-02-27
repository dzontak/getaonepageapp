import type { AiEnhancement, ProjectIntakeData } from "./types";

/**
 * Posts the full intake data + pre-formatted plain text to the Cloudflare Pages
 * Function at /api/submit-intake.
 *
 * The server will:
 *   1. Call Claude to generate a polished brief and site spec
 *   2. Email the Zontak team a lead notification
 *   3. Email the client a confirmation with their brief
 *
 * Returns AiEnhancement on success; throws a descriptive Error on failure.
 */
export async function submitIntake(
  data: ProjectIntakeData,
  plainText: string,
): Promise<AiEnhancement> {
  const response = await fetch("/api/submit-intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, plainText }),
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

  const result = await response.json() as { enhancement: AiEnhancement };
  return result.enhancement;
}
