/**
 * Shared intake domain types.
 * Used by both the API routes (server) and the client-side agent.
 */

export interface BusinessInfo {
  businessName: string;
  businessType: string;
  industry: string;
  website: string;
}

export interface ProjectDescription {
  description: string;
  goals: string;
  callToAction: string;
  content: string;
  imageNotes: string;
}

export interface StylePreferences {
  stylePreset: string;
  primaryColor: string;
  secondaryColor: string;
  styleNotes: string;
  inspirationUrls: string;
}

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  preferredContact: string;
  additionalNotes: string;
}

export interface ProjectIntakeData {
  business: BusinessInfo;
  project: ProjectDescription;
  style: StylePreferences;
  contact: ContactInfo;
}

export interface SiteSection {
  sectionName: string;
  purpose: string;
  suggestedContent: string;
}

export interface SiteSpec {
  headline: string;
  subheadline: string;
  seoDescription: string;
  sections: SiteSection[];
}

export interface AiEnhancement {
  refinedBrief: string;
  siteSpec: SiteSpec;
}
