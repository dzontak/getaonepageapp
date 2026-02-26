"use client";

import type { ProjectBrief } from "@/agents/project-intake";
import { downloadBrief } from "@/agents/project-intake";
import type { AiState } from "@/hooks/useProjectIntake";
import { AiEnhancementPanel } from "./AiEnhancementPanel";

interface ReviewSummaryProps {
  brief: ProjectBrief;
  onReset: () => void;
  aiState: AiState;
  onRefine: () => void;
}

export function ReviewSummary({ brief, onReset, aiState, onRefine }: ReviewSummaryProps) {
  return (
    <div className="animate-slide-in-right">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-orange/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-2">Project Brief Ready</h3>
        <p className="text-foreground/50 text-sm">
          Review your details below, then send or download.
        </p>
      </div>

      {/* Brief Card */}
      <div className="rounded-2xl border border-orange/10 bg-warm-gray/20 p-6 mb-8 space-y-6">
        <div className="flex items-center justify-between border-b border-orange/10 pb-4">
          <h4 className="font-bold text-foreground">{brief.title}</h4>
          <span className="text-xs text-foreground/30">
            {new Date(brief.generatedAt).toLocaleDateString()}
          </span>
        </div>

        {brief.sections.map((section) => (
          <div key={section.heading}>
            <h5 className="text-sm font-semibold text-orange mb-3">{section.heading}</h5>
            <div className="grid gap-2">
              {section.items.map((item) => (
                <div key={item.label} className="flex gap-3 text-sm">
                  <span className="text-foreground/40 min-w-[120px] shrink-0">{item.label}</span>
                  <span className="text-foreground/80 break-words">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href={brief.mailtoLink}
          className="inline-flex items-center justify-center gap-2 bg-orange hover:bg-orange-dark text-warm-black font-bold px-8 py-4 rounded-full text-base transition-all hover:scale-105 shadow-lg shadow-orange/20"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Send via Email
        </a>

        <button
          type="button"
          onClick={() => downloadBrief(brief)}
          className="inline-flex items-center justify-center gap-2 border border-foreground/20 hover:border-orange/50 text-foreground font-medium px-8 py-4 rounded-full text-base transition-all hover:scale-105"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Brief
        </button>
      </div>

      {/* AI Enhancement Section */}
      <div className="mt-8">
        {aiState.status === "idle" && (
          <div className="text-center">
            <button
              type="button"
              onClick={onRefine}
              className="inline-flex items-center justify-center gap-2 border border-orange/30 hover:border-orange/60 bg-orange/5 hover:bg-orange/10 text-orange font-medium px-8 py-3 rounded-full text-sm transition-all hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Refine with Claude AI
            </button>
            <p className="text-foreground/30 text-xs mt-2">
              Let Claude polish your brief and generate a site specification
            </p>
          </div>
        )}

        {aiState.status === "loading" && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-3 text-foreground/60">
              <svg className="w-5 h-5 text-orange animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm">Claude is analyzing your brief…</span>
            </div>
          </div>
        )}

        {aiState.status === "error" && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
            <p className="text-sm text-red-400 mb-3">{aiState.message}</p>
            <button
              type="button"
              onClick={onRefine}
              className="text-sm text-orange hover:text-orange-light underline underline-offset-4 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {aiState.status === "success" && (
          <AiEnhancementPanel enhancement={aiState.data} />
        )}
      </div>

      {/* Start Over */}
      <div className="text-center mt-8">
        <button
          type="button"
          onClick={onReset}
          className="text-foreground/30 text-sm hover:text-orange transition-colors underline underline-offset-4"
        >
          Start over with a new project
        </button>
      </div>
    </div>
  );
}
