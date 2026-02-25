"use client";

import type { ProjectBrief } from "@/agents/project-intake";
import { downloadBrief } from "@/agents/project-intake";

interface ReviewSummaryProps {
  brief: ProjectBrief;
  onReset: () => void;
}

export function ReviewSummary({ brief, onReset }: ReviewSummaryProps) {
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

      {/* Start Over */}
      <div className="text-center mt-6">
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
