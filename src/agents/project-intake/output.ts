import type { ProjectBrief } from "./types";

const MAX_MAILTO_BODY = 1800;

export function formatPlainText(brief: ProjectBrief): string {
  const lines: string[] = [
    brief.title,
    `Generated: ${new Date(brief.generatedAt).toLocaleDateString()}`,
    "═".repeat(50),
    "",
  ];

  for (const section of brief.sections) {
    lines.push(`── ${section.heading} ──`);
    for (const item of section.items) {
      lines.push(`${item.label}: ${item.value}`);
    }
    lines.push("");
  }

  lines.push("─".repeat(50));
  lines.push("Submitted via getaonepage.app");

  return lines.join("\n");
}

export function formatMailtoLink(recipient: string, brief: ProjectBrief): string {
  const subject = encodeURIComponent(brief.title);
  let body = brief.plainText;

  if (body.length > MAX_MAILTO_BODY) {
    body = body.slice(0, MAX_MAILTO_BODY) + "\n\n[Brief truncated — full version available via download]";
  }

  return `mailto:${recipient}?subject=${subject}&body=${encodeURIComponent(body)}`;
}

export function formatDownloadableText(brief: ProjectBrief): string {
  return brief.plainText;
}

export function downloadBrief(brief: ProjectBrief): void {
  const text = formatDownloadableText(brief);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `project-brief-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
