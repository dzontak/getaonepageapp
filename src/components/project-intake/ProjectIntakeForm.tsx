"use client";

import { useProjectIntake } from "@/hooks/useProjectIntake";
import { StepIndicator } from "./StepIndicator";
import { ReviewSummary } from "./ReviewSummary";
import { BusinessInfoStep } from "./steps/BusinessInfoStep";
import { ProjectDescStep } from "./steps/ProjectDescStep";
import { StyleStep } from "./steps/StyleStep";
import { ContactStep } from "./steps/ContactStep";

export function ProjectIntakeForm() {
  const {
    state,
    aiState,
    isSubmitting,
    currentStepErrors,
    next,
    prev,
    goTo,
    updateField,
    submit,
    reset,
    refineWithAI,
    canGoBack,
    isReviewStep,
    isSubmitted,
  } = useProjectIntake();

  /* ─── Submitted → show brief ─── */
  if (isSubmitted && state.brief) {
    return (
      <section id="contact" className="relative py-32 px-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-orange/5 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <ReviewSummary
            brief={state.brief}
            onReset={reset}
            aiState={aiState}
            onRefine={refineWithAI}
          />
        </div>
      </section>
    );
  }

  /* ─── Render current step ─── */
  function renderStep() {
    switch (state.currentStep) {
      case "business":
        return (
          <BusinessInfoStep
            data={state.data.business}
            errors={currentStepErrors}
            onChange={(patch) => updateField("business", patch)}
          />
        );
      case "project":
        return (
          <ProjectDescStep
            data={state.data.project}
            errors={currentStepErrors}
            onChange={(patch) => updateField("project", patch)}
          />
        );
      case "style":
        return (
          <StyleStep
            data={state.data.style}
            errors={currentStepErrors}
            onChange={(patch) => updateField("style", patch)}
          />
        );
      case "contact":
        return (
          <ContactStep
            data={state.data.contact}
            errors={currentStepErrors}
            onChange={(patch) => updateField("contact", patch)}
          />
        );
      case "review":
        return (
          <div className="animate-slide-in-right">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-foreground mb-1">Review your project</h3>
              <p className="text-foreground/40 text-sm">Make sure everything looks right before submitting.</p>
            </div>

            {/* Quick summary card */}
            <div className="rounded-2xl border border-orange/10 bg-warm-gray/20 p-5 space-y-4">
              <SummaryRow label="Business" value={state.data.business.businessName} sub={state.data.business.businessType} />
              <SummaryRow label="Project" value={state.data.project.description.slice(0, 100) + (state.data.project.description.length > 100 ? "..." : "")} sub={`CTA: ${state.data.project.callToAction}`} />
              <SummaryRow label="Style" value={state.data.style.stylePreset.charAt(0).toUpperCase() + state.data.style.stylePreset.slice(1)} />
              <SummaryRow label="Contact" value={state.data.contact.name} sub={state.data.contact.email} />
            </div>

            {/* Submitting indicator */}
            {isSubmitting && (
              <div className="mt-4 flex items-center gap-2 text-foreground/40 text-sm">
                <svg className="w-4 h-4 text-orange animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Claude is processing your brief…
              </div>
            )}
          </div>
        );
    }
  }

  return (
    <section id="contact" className="relative py-32 px-6">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-orange/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8">
          <p className="text-orange uppercase tracking-[0.3em] text-sm font-medium mb-4">Get Started</p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Describe Your <span className="text-gradient-sun">Project</span>
          </h2>
          <p className="text-foreground/50 text-lg">
            Tell us about your business and we&apos;ll build your one-page app.
          </p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={state.currentStep} onStepClick={goTo} />

        {/* Form Content */}
        <div className="rounded-2xl border border-orange/10 bg-warm-gray/10 p-6 sm:p-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isReviewStep) {
                void submit();
              } else {
                next();
              }
            }}
          >
            {renderStep()}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-orange/10">
              {canGoBack ? (
                <button
                  type="button"
                  onClick={prev}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 text-foreground/50 hover:text-foreground text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              ) : (
                <div />
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex items-center gap-2 font-semibold px-6 py-2.5 rounded-full text-sm transition-all ${
                  isSubmitting
                    ? "opacity-70 cursor-not-allowed"
                    : "hover:scale-105"
                } ${
                  isReviewStep
                    ? "bg-orange hover:bg-orange-dark text-warm-black shadow-lg shadow-orange/20"
                    : "bg-orange/15 hover:bg-orange/25 text-orange border border-orange/20"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting…
                  </>
                ) : isReviewStep ? (
                  "Submit Brief"
                ) : (
                  <>
                    Next
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

/* ─── Helper Component ─── */

function SummaryRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-foreground/40 min-w-[80px] shrink-0 font-medium">{label}</span>
      <div>
        <span className="text-foreground/80">{value}</span>
        {sub && <span className="text-foreground/40 ml-2">({sub})</span>}
      </div>
    </div>
  );
}
