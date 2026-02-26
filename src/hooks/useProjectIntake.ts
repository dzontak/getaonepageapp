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

/* ─── localStorage Persistence ─── */

const STORAGE_KEY = "zontak-project-intake";

function saveToStorage(state: IntakeState) {
  if (typeof window === "undefined") return;
  try {
    // Only persist form data, not brief or submission state
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  } catch {
    // Silently fail if storage is full or unavailable
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

    submit: useCallback(() => dispatch({ type: "SUBMIT" }), []),

    reset: useCallback(() => {
      clearStorage();
      setAiState({ status: "idle" });
      dispatch({ type: "RESET" });
    }, []),

    refineWithAI,

    canGoBack: currentIdx > 0,
    canGoForward: currentIdx < FORM_STEPS.length - 1,
    isReviewStep: state.currentStep === "review",
    isSubmitted: state.isSubmitted,
  };
}
