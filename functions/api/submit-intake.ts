/**
 * Cloudflare Pages Function: POST /api/submit-intake
 *
 * Full agentic submission handler:
 *   1. Receives ProjectIntakeData + pre-formatted plain-text brief
 *   2. Calls Claude to generate AiEnhancement (polished brief + site spec)
 *   3. Emails the Zontak team a full lead notification (Resend)
 *   4. Emails the client a confirmation with their polished brief (Resend)
 *   5. Returns { enhancement: AiEnhancement }
 *
 * Required env vars (set in Cloudflare Pages → Settings → Environment Variables):
 *   ANTHROPIC_API_KEY  — Anthropic API key
 *   RESEND_API_KEY     — Resend API key
 *   NOTIFY_EMAIL       — where team notifications are sent, e.g. hello@zontak.com
 *   FROM_EMAIL         — verified Resend sender, e.g. noreply@getaonepageapp.com
 *
 * Type definitions are inlined because Workers bundle independently from Next.js
 * and cannot resolve src/ path aliases. Keep in sync with types.ts → AiEnhancement.
 */

/* ─── Inlined Types ─── */

interface BusinessInfo {
  businessName: string;
  businessType: string;
  industry: string;
  website: string;
}

interface ProjectDescription {
  description: string;
  goals: string;
  callToAction: string;
  content: string;
  imageNotes: string;
}

interface StylePreferences {
  stylePreset: string;
  primaryColor: string;
  secondaryColor: string;
  styleNotes: string;
  inspirationUrls: string;
}

interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  preferredContact: string;
  additionalNotes: string;
}

interface ProjectIntakeData {
  business: BusinessInfo;
  project: ProjectDescription;
  style: StylePreferences;
  contact: ContactInfo;
}

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
  RESEND_API_KEY: string;
  NOTIFY_EMAIL: string;
  FROM_EMAIL: string;
}

/* ─── Claude Prompt ─── */

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

/* ─── Email Templates ─── */

function teamEmailHtml(data: ProjectIntakeData, enhancement: AiEnhancement): string {
  const { business, project, style, contact } = data;
  const { refinedBrief, siteSpec } = enhancement;
  const row = (label: string, value: string) =>
    value ? `<tr><td style="color:#666;padding:6px 12px 6px 0;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td><td style="color:#ccc;padding:6px 0;font-size:13px">${value}</td></tr>` : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e0e0e0">
<div style="max-width:640px;margin:0 auto;padding:32px 20px">

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:24px;margin-bottom:20px">
    <p style="color:#F07D2E;font-size:22px;font-weight:800;margin:0 0 4px">🔥 New Project Lead</p>
    <p style="color:#666;font-size:13px;margin:0">${new Date().toLocaleString("en-US", { timeZoneName: "short" })} · via getaonepageapp.com</p>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:20px;margin-bottom:16px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 14px">Business</p>
    <table style="border-collapse:collapse;width:100%">
      ${row("Business Name", business.businessName)}
      ${row("Type", business.businessType)}
      ${row("Industry", business.industry)}
      ${row("Existing Site", business.website)}
    </table>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:20px;margin-bottom:16px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 14px">Project</p>
    <table style="border-collapse:collapse;width:100%">
      ${row("Description", project.description)}
      ${row("Goals", project.goals)}
      ${row("Call to Action", project.callToAction)}
      ${row("Content Notes", project.content)}
      ${row("Image Notes", project.imageNotes)}
    </table>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:20px;margin-bottom:16px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 14px">Style</p>
    <table style="border-collapse:collapse;width:100%">
      ${row("Preset", style.stylePreset)}
      ${row("Primary Color", style.primaryColor)}
      ${row("Secondary Color", style.secondaryColor)}
      ${row("Style Notes", style.styleNotes)}
      ${row("Inspiration", style.inspirationUrls)}
    </table>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:20px;margin-bottom:16px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 14px">Contact</p>
    <table style="border-collapse:collapse;width:100%">
      ${row("Name", contact.name)}
      <tr><td style="color:#666;padding:6px 12px 6px 0;font-size:13px;white-space:nowrap">Email</td><td style="padding:6px 0;font-size:13px"><a href="mailto:${contact.email}" style="color:#3DA7DB">${contact.email}</a></td></tr>
      ${row("Phone", contact.phone)}
      ${row("Preferred Contact", contact.preferredContact)}
      ${row("Additional Notes", contact.additionalNotes)}
    </table>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:20px;margin-bottom:16px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 14px">Claude's Polished Brief</p>
    <div style="background:#111;border-left:3px solid #F07D2E;padding:16px;border-radius:0 8px 8px 0;font-size:14px;line-height:1.8;color:#bbb;white-space:pre-wrap">${refinedBrief}</div>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:20px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 14px">Proposed Site Spec</p>
    <p style="color:#fff;font-size:18px;font-weight:700;margin:0 0 6px">${siteSpec.headline}</p>
    <p style="color:#aaa;font-size:14px;margin:0 0 6px">${siteSpec.subheadline}</p>
    <p style="color:#555;font-size:12px;font-style:italic;margin:0 0 16px">SEO: ${siteSpec.seoDescription}</p>
    ${siteSpec.sections.map((s, i) => `
    <div style="border-top:1px solid #2a2a2a;padding:12px 0${i === 0 ? ";border-top:none;padding-top:0" : ""}">
      <p style="color:#F07D2E;font-size:12px;font-weight:600;margin:0 0 4px">${s.sectionName}</p>
      <p style="color:#888;font-size:12px;margin:0 0 4px">${s.purpose}</p>
      <p style="color:#aaa;font-size:13px;line-height:1.5;margin:0">${s.suggestedContent}</p>
    </div>`).join("")}
  </div>

</div>
</body></html>`;
}

function clientEmailHtml(data: ProjectIntakeData, enhancement: AiEnhancement): string {
  const { business, contact } = data;
  const { refinedBrief, siteSpec } = enhancement;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e0e0e0">
<div style="max-width:600px;margin:0 auto;padding:40px 20px">

  <div style="text-align:center;margin-bottom:36px">
    <p style="font-size:26px;font-weight:800;margin:0 0 6px"><span style="color:#F07D2E">ZON</span><span style="color:#3DA7DB">TAK</span></p>
    <p style="color:#555;font-size:13px;margin:0">Your project brief is ready</p>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:28px;margin-bottom:20px">
    <p style="font-size:16px;color:#e0e0e0;margin:0 0 12px">Hi ${contact.name} 👋</p>
    <p style="color:#aaa;font-size:14px;line-height:1.8;margin:0">We've received your project brief for <strong style="color:#fff">${business.businessName}</strong> and Claude has already been hard at work on it. Our team will review everything and reach out within <strong style="color:#F07D2E">24 hours</strong>.</p>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:28px;margin-bottom:20px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 16px">Your Polished Brief</p>
    <p style="font-size:14px;line-height:1.85;color:#ccc;margin:0;white-space:pre-wrap">${refinedBrief}</p>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:28px;margin-bottom:28px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 16px">Proposed Site Structure</p>
    <p style="color:#fff;font-size:20px;font-weight:700;margin:0 0 8px">${siteSpec.headline}</p>
    <p style="color:#aaa;font-size:14px;line-height:1.6;margin:0 0 20px">${siteSpec.subheadline}</p>
    ${siteSpec.sections.map((s, i) => `
    <div style="border-top:1px solid #2a2a2a;padding:12px 0${i === 0 ? ";border-top:none;padding-top:0" : ""}">
      <p style="color:#F07D2E;font-size:12px;font-weight:600;margin:0 0 4px">${s.sectionName}</p>
      <p style="color:#aaa;font-size:13px;line-height:1.5;margin:0">${s.suggestedContent}</p>
    </div>`).join("")}
  </div>

  <div style="text-align:center;margin-bottom:32px">
    <a href="https://buy.stripe.com/6oU5kw8yRd603SI0bNfjG00" style="display:inline-block;background:#F07D2E;color:#0d0d0d;font-weight:700;font-size:15px;padding:16px 36px;border-radius:999px;text-decoration:none">Pay $100 / year to Start →</a>
    <p style="color:#444;font-size:12px;margin:10px 0 0">Build · Deploy · Hosting · SSL · Maintenance · All included</p>
  </div>

  <div style="text-align:center;padding-top:20px;border-top:1px solid #1a1a1a">
    <p style="color:#444;font-size:12px;margin:0">© ${new Date().getFullYear()} Zontak LLC · <a href="https://getaonepageapp.com" style="color:#F07D2E;text-decoration:none">getaonepageapp.com</a></p>
    <p style="color:#333;font-size:12px;margin:6px 0 0">Questions? Just reply to this email.</p>
  </div>

</div>
</body></html>`;
}

/* ─── Handler ─── */

export async function onRequestPost(context: EventContext<Env, string, unknown>): Promise<Response> {
  const { request, env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let data: ProjectIntakeData;
  let plainText: string;
  try {
    const body = await request.json() as { data?: unknown; plainText?: unknown };
    if (!body.data || typeof body.plainText !== "string" || !body.plainText.trim()) {
      return Response.json({ error: "Missing required fields: data, plainText" }, { status: 400 });
    }
    data = body.data as ProjectIntakeData;
    plainText = body.plainText.trim();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── 1. Call Claude ──────────────────────────────────────────────────────────
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
        { role: "user", content: `Here is the client's project brief:\n\n${plainText}` },
      ],
    }),
  });

  if (!anthropicResponse.ok) {
    const errorText = await anthropicResponse.text();
    console.error("Anthropic API error:", anthropicResponse.status, errorText);
    return Response.json({ error: "Failed to process with AI. Please try again." }, { status: 502 });
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
    console.error("Failed to parse Claude response:", rawText.slice(0, 200));
    return Response.json({ error: "AI returned unexpected format. Please try again." }, { status: 502 });
  }

  // ── 2. Send emails (fire-and-forget — don't block or fail on email errors) ──
  const canEmail = !!(env.RESEND_API_KEY && env.NOTIFY_EMAIL && env.FROM_EMAIL);
  if (canEmail) {
    const headers = {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    };

    const sendTeam = fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: env.NOTIFY_EMAIL,
        subject: `🔥 New Lead: ${data.business.businessName} — ${data.business.businessType}`,
        html: teamEmailHtml(data, enhancement),
      }),
    }).then(async (r) => {
      if (!r.ok) console.error("Team email error:", await r.text());
    }).catch((err) => console.error("Team email failed:", err));

    const sendClient = data.contact.email
      ? fetch("https://api.resend.com/emails", {
          method: "POST",
          headers,
          body: JSON.stringify({
            from: env.FROM_EMAIL,
            to: data.contact.email,
            subject: `Your Zontak project brief for ${data.business.businessName} is ready ✓`,
            html: clientEmailHtml(data, enhancement),
          }),
        }).then(async (r) => {
          if (!r.ok) console.error("Client email error:", await r.text());
        }).catch((err) => console.error("Client email failed:", err))
      : Promise.resolve();

    await Promise.all([sendTeam, sendClient]);
  } else {
    console.warn("Email env vars not fully configured — skipping email notifications");
  }

  // ── 3. Return enhancement ───────────────────────────────────────────────────
  return Response.json(
    { enhancement },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function onRequestGet(): Promise<Response> {
  return Response.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}
