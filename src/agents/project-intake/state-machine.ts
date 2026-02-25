import type {
  FormStep,
  IntakeState,
  ProjectIntakeData,
  ValidationError,
} from "./types";
import { FORM_STEPS } from "./types";
import {
  validateBusinessInfo,
  validateProjectDescription,
  validateStylePreferences,
  validateContactInfo,
  validateAll,
} from "./validation";
import { generateBrief } from "./processing";

/* ─── Initial State ─── */

export function createInitialState(): IntakeState {
  return {
    currentStep: "business",
    data: {
      business: {
        businessName: "",
        businessType: "",
        industry: "",
        website: "",
      },
      project: {
        description: "",
        goals: "",
        callToAction: "",
        content: "",
        imageNotes: "",
      },
      style: {
        stylePreset: "warm",
        primaryColor: "#F07D2E",
        secondaryColor: "#FFB347",
        styleNotes: "",
        inspirationUrls: "",
      },
      contact: {
        name: "",
        email: "",
        phone: "",
        preferredContact: "email",
        additionalNotes: "",
      },
    },
    stepErrors: {},
    isSubmitted: false,
    brief: null,
  };
}

/* ─── Step Validators Map ─── */

const stepValidators: Record<
  Exclude<FormStep, "review">,
  (data: ProjectIntakeData) => { valid: boolean; errors: ValidationError[] }
> = {
  business: (d) => validateBusinessInfo(d.business),
  project: (d) => validateProjectDescription(d.project),
  style: (d) => validateStylePreferences(d.style),
  contact: (d) => validateContactInfo(d.contact),
};

/* ─── Navigation ─── */

export function nextStep(state: IntakeState): IntakeState {
  const idx = FORM_STEPS.indexOf(state.currentStep);
  if (idx >= FORM_STEPS.length - 1) return state;

  // Validate current step before advancing (skip review)
  if (state.currentStep !== "review") {
    const result = stepValidators[state.currentStep](state.data);
    if (!result.valid) {
      return {
        ...state,
        stepErrors: { ...state.stepErrors, [state.currentStep]: result.errors },
      };
    }
  }

  return {
    ...state,
    currentStep: FORM_STEPS[idx + 1],
    stepErrors: { ...state.stepErrors, [state.currentStep]: [] },
  };
}

export function prevStep(state: IntakeState): IntakeState {
  const idx = FORM_STEPS.indexOf(state.currentStep);
  if (idx <= 0) return state;
  return { ...state, currentStep: FORM_STEPS[idx - 1] };
}

export function goToStep(state: IntakeState, step: FormStep): IntakeState {
  const targetIdx = FORM_STEPS.indexOf(step);
  const currentIdx = FORM_STEPS.indexOf(state.currentStep);
  // Only allow going to steps at or before current position
  if (targetIdx <= currentIdx) {
    return { ...state, currentStep: step };
  }
  return state;
}

/* ─── Data Updates ─── */

export function updateStepData<K extends keyof ProjectIntakeData>(
  state: IntakeState,
  stepKey: K,
  patch: Partial<ProjectIntakeData[K]>,
): IntakeState {
  return {
    ...state,
    data: {
      ...state.data,
      [stepKey]: { ...state.data[stepKey], ...patch },
    },
    // Clear errors for the step being edited
    stepErrors: { ...state.stepErrors, [stepKey]: [] },
  };
}

/* ─── Submission ─── */

export function submitForm(state: IntakeState): IntakeState {
  const result = validateAll(state.data);
  if (!result.valid) {
    return {
      ...state,
      stepErrors: { ...state.stepErrors, review: result.errors },
    };
  }

  const brief = generateBrief(state.data);
  return {
    ...state,
    isSubmitted: true,
    brief,
    stepErrors: {},
  };
}

/* ─── Reset ─── */

export function resetForm(): IntakeState {
  return createInitialState();
}
