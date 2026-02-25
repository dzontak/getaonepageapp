"use client";

import { FORM_STEPS, STEP_LABELS, type FormStep } from "@/agents/project-intake";

interface StepIndicatorProps {
  currentStep: FormStep;
  onStepClick: (step: FormStep) => void;
}

export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  const currentIdx = FORM_STEPS.indexOf(currentStep);

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-10">
      {FORM_STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isClickable = idx <= currentIdx;

        return (
          <div key={step} className="flex items-center">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                isCurrent
                  ? "bg-orange/15 text-orange border border-orange/30"
                  : isCompleted
                    ? "bg-orange/5 text-orange/70 border border-orange/10 hover:border-orange/30 cursor-pointer"
                    : "bg-warm-gray/30 text-foreground/30 border border-transparent cursor-default"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isCurrent
                    ? "bg-orange text-warm-black"
                    : isCompleted
                      ? "bg-orange/20 text-orange"
                      : "bg-warm-gray/50 text-foreground/30"
                }`}
              >
                {isCompleted ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </span>
              <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
            </button>

            {idx < FORM_STEPS.length - 1 && (
              <div
                className={`w-4 sm:w-8 h-px mx-1 ${
                  idx < currentIdx ? "bg-orange/40" : "bg-warm-gray/40"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
