"use client";

import { useReducer, useCallback, useEffect, useState } from "react";
import type {
  FormStep,
  IntakeState,
  ProjectIntakeData,
  AiEnhancement,
} from "@/agents/project-intake";
import {
  FORM_STEPS,
  createInitialState,
  nextStep,
  prevStep,
  goToStep,
  updateStepData,
  submitForm,
  resetForm,
  formatPlainText,
  refineWithClaude,
  submitIntake,
  generateBrief,
} from "@/agents/project-intake";

/* ─── Reducer ─── */

type Action =
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "GO_TO_STEP"; step: FormStep }
  | { type: "UPDATE_DATA"; stepKey: keyof ProjectIntakeData; patch: Record<string, unknown> }
  | { type: "SUBMIT" }
  | { type: "RESET" }
  | { type: "RESTORE"; state: IntakeState };

function reducer(state: IntakeState, action: Action): IntakeState {
  switch (action.type) {
    case "NEXT_STEP":
      return nextStep(state);
    case "PREV_STEP":
      return prevStep(state);
    case "GO_TO_STEP":
      return goToStep(state, action.step);
    case "UPDATE_DATA":
      return updateStepData(state, action.stepKey, action.patch);
    case "SUBMIT":
      return submitForm(state);
    case "RESET":
      return resetForm();
    case "RESTORE":
      return action.state;
    default:
      return state;
  }
}

/* ─── AI State Type ─── */

export type AiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: AiEnhancement }
  | { status: "error"; message: string };

/* ─── Session Metadata (from Attractor graph result) ─── */

export interface SessionMeta {
  sessionId: string;
  validationScore?: number;
  creditsRemaining?: number;
  nodeHistory: Array<{ from: string; to: string; edge: string; durationMs: number }>;
}

/* ─── localStorage Persistence ─── */

const STORAGE_KEY = "zontak-project-intake";

function saveToStorage(state: IntakeState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  } catch {
    // Silently fail
  }
}

function loadFromStorage(): ProjectIntakeData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProjectIntakeData;
  } catch {
    return null;
  }
}

function clearStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail
  }
}

/* ─── Hook ─── */

export function useProjectIntake() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const [aiState, setAiState] = useState<AiState>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionMeta, setSessionMeta] = useState<SessionMeta | null>(null);
  const [iterationCount, setIterationCount] = useState(0);

  // Restore from localStorage on mount
  useEffect(() => {
    const savedData = loadFromStorage();
    if (savedData) {
      const restored: IntakeState = {
        ...createInitialState(),
        data: savedData,
      };
      dispatch({ type: "RESTORE", state: restored });
    }
  }, []);

  // Persist data on every change
  useEffect(() => {
    if (!state.isSubmitted) {
      saveToStorage(state);
    }
  }, [state]);

  const currentIdx = FORM_STEPS.indexOf(state.currentStep);
  const stepKey = state.currentStep === "review" ? null : state.currentStep;

  /**
   * Full Attractor graph submission.
   *
   * Flow:
   *   1. Generate plain-text brief client-side (for the server prompt)
   *   2. POST to /api/submit-intake → runs 4-node graph server-side
   *   3. On success: mark submitted + auto-populate AI panel + store session meta
   *   4. On failure: graceful fallback — mark submitted locally; manual Refine available
   */
  const submit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const tempBrief = generateBrief(state.data);
      const plainText = formatPlainText(tempBrief);

      const result = await submitIntake(state.data, plainText, iterationCount);

      dispatch({ type: "SUBMIT" });

      if (result.enhancement) {
        setAiState({ status: "success", data: result.enhancement });
      }

      setSessionMeta({
        sessionId: result.sessionId,
        validationScore: result.validationScore,
        creditsRemaining: result.creditsRemaining,
        nodeHistory: result.history,
      });

      clearStorage();
    } catch {
      // Graceful fallback: show local brief, manual Refine button stays available
      dispatch({ type: "SUBMIT" });
    } finally {
      setIsSubmitting(false);
    }
  }, [state.data, iterationCount]);

  /**
   * Manual re-refinement — used as fallback when auto-submit failed (dev / network error)
   * or when the user wants to regenerate. Uses the existing /api/refine-brief endpoint.
   */
  const refineWithAI = useCallback(async () => {
    if (!state.brief) return;
    setAiState({ status: "loading" });
    try {
      const plainText = formatPlainText(state.brief);
      const data = await refineWithClaude(plainText);
      setAiState({ status: "success", data });
    } catch (err) {
      setAiState({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
    }
  }, [state.brief]);

  return {
    state,
    aiState,
    isSubmitting,
    sessionMeta,
    currentStepErrors: stepKey ? (state.stepErrors[stepKey] ?? []) : [],
    reviewErrors: state.stepErrors.review ?? [],

    updateField: useCallback(
      (stepKey: keyof ProjectIntakeData, patch: Record<string, unknown>) => {
        dispatch({ type: "UPDATE_DATA", stepKey, patch });
      },
      [],
    ),

    next: useCallback(() => dispatch({ type: "NEXT_STEP" }), []),
    prev: useCallback(() => dispatch({ type: "PREV_STEP" }), []),
    goTo: useCallback((step: FormStep) => dispatch({ type: "GO_TO_STEP", step }), []),

    submit,

    reset: useCallback(() => {
      clearStorage();
      setAiState({ status: "idle" });
      setIsSubmitting(false);
      setSessionMeta(null);
      setIterationCount(0);
      dispatch({ type: "RESET" });
    }, []),

    refineWithAI,

    canGoBack: currentIdx > 0,
    canGoForward: currentIdx < FORM_STEPS.length - 1,
    isReviewStep: state.currentStep === "review",
    isSubmitted: state.isSubmitted,
  };
}
