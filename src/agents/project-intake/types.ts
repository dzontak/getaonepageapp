/* ─── Form Steps ─── */

export type FormStep = "business" | "project" | "style" | "contact" | "review";

export const FORM_STEPS: FormStep[] = [
  "business",
  "project",
  "style",
  "contact",
  "review",
];

export const STEP_LABELS: Record<FormStep, string> = {
  business: "Business",
  project: "Project",
  style: "Style",
  contact: "Contact",
  review: "Review",
};

/* ─── Business Types ─── */

export const BUSINESS_TYPES = [
  "Restaurant / Food",
  "Retail / Shop",
  "Professional Services",
  "Home Services / Trades",
  "Health / Wellness",
  "Creative / Portfolio",
  "Non-Profit",
  "Event / Venue",
  "Other",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

/* ─── Style Presets ─── */

export interface StylePresetOption {
  id: string;
  label: string;
  colors: string[];
}

export const STYLE_PRESETS: StylePresetOption[] = [
  { id: "warm", label: "Warm & Friendly", colors: ["#F07D2E", "#FFB347", "#FFF8EE"] },
  { id: "cool", label: "Cool & Professional", colors: ["#3DA7DB", "#5EC4F0", "#F5F5F5"] },
  { id: "bold", label: "Bold & Modern", colors: ["#E53E3E", "#1A1A2E", "#FFFFFF"] },
  { id: "earth", label: "Earthy & Natural", colors: ["#6B8E23", "#8B7355", "#FFF8DC"] },
  { id: "minimal", label: "Minimal & Clean", colors: ["#333333", "#666666", "#FFFFFF"] },
  { id: "custom", label: "Custom Colors", colors: [] },
];

/* ─── Form Data ─── */

export interface BusinessInfo {
  businessName: string;
  businessType: BusinessType | "";
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
  preferredContact: "email" | "phone" | "either";
  additionalNotes: string;
}

export interface ProjectIntakeData {
  business: BusinessInfo;
  project: ProjectDescription;
  style: StylePreferences;
  contact: ContactInfo;
}

/* ─── Validation ─── */

export interface ValidationError {
  field: string;
  message: string;
}

export interface StepValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/* ─── Output ─── */

export interface BriefSection {
  heading: string;
  items: { label: string; value: string }[];
}

export interface ProjectBrief {
  title: string;
  generatedAt: string;
  sections: BriefSection[];
  mailtoLink: string;
  plainText: string;
}

/* ─── AI Enhancement ─── */

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

/* ─── State ─── */

export interface IntakeState {
  currentStep: FormStep;
  data: ProjectIntakeData;
  stepErrors: Partial<Record<FormStep, ValidationError[]>>;
  isSubmitted: boolean;
  brief: ProjectBrief | null;
}
