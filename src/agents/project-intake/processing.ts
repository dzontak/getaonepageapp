import type { ProjectIntakeData, ProjectBrief, BriefSection } from "./types";
import { STYLE_PRESETS } from "./types";
import { formatPlainText, formatMailtoLink } from "./output";

export function generateBrief(data: ProjectIntakeData): ProjectBrief {
  const { business, project, style, contact } = data;

  const presetLabel =
    STYLE_PRESETS.find((p) => p.id === style.stylePreset)?.label ?? style.stylePreset;

  const sections: BriefSection[] = [
    {
      heading: "Business Details",
      items: [
        { label: "Business Name", value: business.businessName },
        { label: "Type", value: business.businessType },
        ...(business.industry ? [{ label: "Industry", value: business.industry }] : []),
        ...(business.website ? [{ label: "Existing Website", value: business.website }] : []),
      ],
    },
    {
      heading: "Project Requirements",
      items: [
        { label: "Description", value: project.description },
        { label: "Site Goals", value: project.goals },
        { label: "Primary CTA", value: project.callToAction },
        ...(project.content ? [{ label: "Content", value: project.content }] : []),
        ...(project.imageNotes ? [{ label: "Image Notes", value: project.imageNotes }] : []),
      ],
    },
    {
      heading: "Style Preferences",
      items: [
        { label: "Style", value: presetLabel },
        ...(style.stylePreset === "custom"
          ? [
              { label: "Primary Color", value: style.primaryColor },
              { label: "Secondary Color", value: style.secondaryColor },
            ]
          : []),
        ...(style.styleNotes ? [{ label: "Notes", value: style.styleNotes }] : []),
        ...(style.inspirationUrls
          ? [{ label: "Inspiration", value: style.inspirationUrls }]
          : []),
      ],
    },
    {
      heading: "Contact Information",
      items: [
        { label: "Name", value: contact.name },
        { label: "Email", value: contact.email },
        ...(contact.phone ? [{ label: "Phone", value: contact.phone }] : []),
        { label: "Preferred Contact", value: contact.preferredContact },
        ...(contact.additionalNotes
          ? [{ label: "Additional Notes", value: contact.additionalNotes }]
          : []),
      ],
    },
  ];

  const title = `Project Brief: ${business.businessName}`;
  const generatedAt = new Date().toISOString();

  const brief: ProjectBrief = {
    title,
    generatedAt,
    sections,
    plainText: "",
    mailtoLink: "",
  };

  // Generate text/mailto after building sections
  brief.plainText = formatPlainText(brief);
  brief.mailtoLink = formatMailtoLink("getaonepageapp@gmail.com", brief);

  return brief;
}
