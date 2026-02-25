import type {
  BusinessInfo,
  ProjectDescription,
  StylePreferences,
  ContactInfo,
  ProjectIntakeData,
  StepValidationResult,
  ValidationError,
} from "./types";
import { BUSINESS_TYPES } from "./types";

/* ─── Helpers ─── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function err(field: string, message: string): ValidationError {
  return { field, message };
}

/* ─── Step Validators ─── */

export function validateBusinessInfo(data: BusinessInfo): StepValidationResult {
  const errors: ValidationError[] = [];
  const name = data.businessName.trim();

  if (!name) {
    errors.push(err("businessName", "Business name is required."));
  } else if (name.length < 2 || name.length > 100) {
    errors.push(err("businessName", "Business name must be 2–100 characters."));
  }

  if (!data.businessType) {
    errors.push(err("businessType", "Please select a business type."));
  } else if (!(BUSINESS_TYPES as readonly string[]).includes(data.businessType)) {
    errors.push(err("businessType", "Invalid business type."));
  }

  return { valid: errors.length === 0, errors };
}

export function validateProjectDescription(data: ProjectDescription): StepValidationResult {
  const errors: ValidationError[] = [];
  const desc = data.description.trim();
  const goals = data.goals.trim();
  const cta = data.callToAction.trim();

  if (!desc) {
    errors.push(err("description", "Project description is required."));
  } else if (desc.length < 20) {
    errors.push(err("description", "Please provide at least 20 characters."));
  } else if (desc.length > 2000) {
    errors.push(err("description", "Description must be under 2000 characters."));
  }

  if (!goals) {
    errors.push(err("goals", "Site goals are required."));
  } else if (goals.length < 10) {
    errors.push(err("goals", "Please provide at least 10 characters."));
  } else if (goals.length > 500) {
    errors.push(err("goals", "Goals must be under 500 characters."));
  }

  if (!cta) {
    errors.push(err("callToAction", "Primary call-to-action is required."));
  } else if (cta.length < 2 || cta.length > 100) {
    errors.push(err("callToAction", "Call-to-action must be 2–100 characters."));
  }

  return { valid: errors.length === 0, errors };
}

export function validateStylePreferences(data: StylePreferences): StepValidationResult {
  const errors: ValidationError[] = [];

  if (data.stylePreset === "custom") {
    if (!data.primaryColor || !HEX_RE.test(data.primaryColor)) {
      errors.push(err("primaryColor", "Please choose a valid primary color."));
    }
    if (!data.secondaryColor || !HEX_RE.test(data.secondaryColor)) {
      errors.push(err("secondaryColor", "Please choose a valid secondary color."));
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateContactInfo(data: ContactInfo): StepValidationResult {
  const errors: ValidationError[] = [];
  const name = data.name.trim();
  const email = data.email.trim();
  const phone = data.phone.replace(/\D/g, "");

  if (!name) {
    errors.push(err("name", "Your name is required."));
  } else if (name.length < 2 || name.length > 100) {
    errors.push(err("name", "Name must be 2–100 characters."));
  }

  if (!email) {
    errors.push(err("email", "Email address is required."));
  } else if (!EMAIL_RE.test(email)) {
    errors.push(err("email", "Please enter a valid email address."));
  }

  if (data.phone.trim() && phone.length < 7) {
    errors.push(err("phone", "Phone number must have at least 7 digits."));
  }

  return { valid: errors.length === 0, errors };
}

/* ─── Full-form Validator ─── */

export function validateAll(data: ProjectIntakeData): StepValidationResult {
  const results = [
    validateBusinessInfo(data.business),
    validateProjectDescription(data.project),
    validateStylePreferences(data.style),
    validateContactInfo(data.contact),
  ];

  const allErrors = results.flatMap((r) => r.errors);
  return { valid: allErrors.length === 0, errors: allErrors };
}
