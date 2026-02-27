/**
 * HTML email templates for the deliver node.
 *
 * Two emails sent on each successful graph run:
 *   1. teamEmail   — structured lead notification to the Zontak team
 *   2. clientEmail — confirmation + polished brief + Stripe CTA to the client
 */

import type { ProjectIntakeData } from "./intake-types";
import type { GenerateOutput, ValidateOutput } from "./graph-types";

/* ─── Team notification ─── */

export function teamEmailHtml(
  data: ProjectIntakeData,
  enhancement: GenerateOutput,
  validation: ValidateOutput | undefined,
  iterationCount: number,
): string {
  const { business, project, style, contact } = data;
  const { refinedBrief, siteSpec } = enhancement;
  const row = (label: string, value: string) =>
    value
      ? `<tr>
           <td style="color:#666;padding:6px 12px 6px 0;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td>
           <td style="color:#ccc;padding:6px 0;font-size:13px">${value}</td>
         </tr>`
      : "";

  const scoreBlock = validation
    ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">
        ${scoreChip("Clarity", validation.scores.clarity)}
        ${scoreChip("Completeness", validation.scores.completeness)}
        ${scoreChip("CTA", validation.scores.ctaStrength)}
        ${scoreChip("Flow", validation.scores.sectionFlow)}
        ${scoreChip("Overall", validation.overallScore, true)}
       </div>`
    : "";

  const iterBadge = iterationCount > 0
    ? `<span style="background:#3DA7DB22;color:#3DA7DB;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-left:8px">REVISION #${iterationCount}</span>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e0e0e0">
<div style="max-width:640px;margin:0 auto;padding:32px 20px">

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:24px;margin-bottom:20px">
    <p style="color:#F07D2E;font-size:22px;font-weight:800;margin:0 0 4px">
      🔥 New Project Lead${iterBadge}
    </p>
    <p style="color:#666;font-size:13px;margin:0">
      ${new Date().toLocaleString("en-US", { timeZoneName: "short" })} · via getaonepageapp.com
    </p>
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
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 14px">Contact</p>
    <table style="border-collapse:collapse;width:100%">
      ${row("Name", contact.name)}
      <tr>
        <td style="color:#666;padding:6px 12px 6px 0;font-size:13px;white-space:nowrap">Email</td>
        <td style="padding:6px 0;font-size:13px">
          <a href="mailto:${contact.email}" style="color:#3DA7DB">${contact.email}</a>
        </td>
      </tr>
      ${row("Phone", contact.phone)}
      ${row("Preferred Contact", contact.preferredContact)}
      ${row("Additional Notes", contact.additionalNotes)}
    </table>
  </div>

  ${validation ? `
  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:20px;margin-bottom:16px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 14px">
      Validation Scores
    </p>
    ${scoreBlock}
    ${validation.critique ? `<p style="color:#888;font-size:13px;margin:12px 0 0;line-height:1.5">${validation.critique}</p>` : ""}
  </div>` : ""}

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:20px;margin-bottom:16px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 14px">
      Claude's Polished Brief
    </p>
    <div style="background:#111;border-left:3px solid #F07D2E;padding:16px;border-radius:0 8px 8px 0;font-size:14px;line-height:1.8;color:#bbb;white-space:pre-wrap">${refinedBrief}</div>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:20px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 14px">
      Proposed Site Spec
    </p>
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

/* ─── Client confirmation ─── */

export function clientEmailHtml(
  data: ProjectIntakeData,
  enhancement: GenerateOutput,
  creditsRemaining: number,
): string {
  const { business, contact } = data;
  const { refinedBrief, siteSpec } = enhancement;

  const creditNote = creditsRemaining <= 1
    ? `<p style="color:#888;font-size:13px;text-align:center;margin:8px 0 0">
         You have <strong style="color:#F07D2E">${creditsRemaining}</strong> revision credit${creditsRemaining === 1 ? "" : "s"} remaining.
       </p>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e0e0e0">
<div style="max-width:600px;margin:0 auto;padding:40px 20px">

  <div style="text-align:center;margin-bottom:36px">
    <p style="font-size:26px;font-weight:800;margin:0 0 6px">
      <span style="color:#F07D2E">ZON</span><span style="color:#3DA7DB">TAK</span>
    </p>
    <p style="color:#555;font-size:13px;margin:0">Your project brief is ready</p>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:28px;margin-bottom:20px">
    <p style="font-size:16px;color:#e0e0e0;margin:0 0 12px">Hi ${contact.name} 👋</p>
    <p style="color:#aaa;font-size:14px;line-height:1.8;margin:0">
      We've received your project brief for <strong style="color:#fff">${business.businessName}</strong>.
      Claude has reviewed and polished it — our team will reach out within
      <strong style="color:#F07D2E">24 hours</strong>.
    </p>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:28px;margin-bottom:20px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 16px">
      Your Polished Brief
    </p>
    <p style="font-size:14px;line-height:1.85;color:#ccc;margin:0;white-space:pre-wrap">${refinedBrief}</p>
  </div>

  <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:28px;margin-bottom:28px">
    <p style="color:#F07D2E;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 16px">
      Proposed Site Structure
    </p>
    <p style="color:#fff;font-size:20px;font-weight:700;margin:0 0 8px">${siteSpec.headline}</p>
    <p style="color:#aaa;font-size:14px;line-height:1.6;margin:0 0 20px">${siteSpec.subheadline}</p>
    ${siteSpec.sections.map((s, i) => `
    <div style="border-top:1px solid #2a2a2a;padding:12px 0${i === 0 ? ";border-top:none;padding-top:0" : ""}">
      <p style="color:#F07D2E;font-size:12px;font-weight:600;margin:0 0 4px">${s.sectionName}</p>
      <p style="color:#aaa;font-size:13px;line-height:1.5;margin:0">${s.suggestedContent}</p>
    </div>`).join("")}
  </div>

  <div style="text-align:center;margin-bottom:32px">
    <a href="https://buy.stripe.com/6oU5kw8yRd603SI0bNfjG00"
       style="display:inline-block;background:#F07D2E;color:#0d0d0d;font-weight:700;font-size:15px;padding:16px 36px;border-radius:999px;text-decoration:none">
      Pay $100 / year to Start →
    </a>
    <p style="color:#444;font-size:12px;margin:10px 0 0">Build · Deploy · Hosting · SSL · Maintenance · All included</p>
    ${creditNote}
  </div>

  <div style="text-align:center;padding-top:20px;border-top:1px solid #1a1a1a">
    <p style="color:#444;font-size:12px;margin:0">
      © ${new Date().getFullYear()} Zontak LLC ·
      <a href="https://getaonepageapp.com" style="color:#F07D2E;text-decoration:none">getaonepageapp.com</a>
    </p>
    <p style="color:#333;font-size:12px;margin:6px 0 0">Questions? Just reply to this email.</p>
  </div>

</div>
</body></html>`;
}

/* ─── Helper ─── */

function scoreChip(label: string, score: number, bold = false): string {
  const color = score >= 7 ? "#4ade80" : score >= 5 ? "#fbbf24" : "#f87171";
  const displayScore = typeof score === "number" ? score.toFixed(1) : score;
  return `<div style="background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:8px 12px;text-align:center;min-width:60px">
    <p style="color:#666;font-size:10px;margin:0 0 2px;text-transform:uppercase;letter-spacing:.05em">${label}</p>
    <p style="color:${color};font-size:18px;font-weight:${bold ? "800" : "600"};margin:0">${displayScore}</p>
  </div>`;
}
