"use client";

import { useState } from "react";
import type { AiEnhancement } from "@/agents/project-intake";

interface AiEnhancementPanelProps {
  enhancement: AiEnhancement;
}

type Tab = "brief" | "spec";

export function AiEnhancementPanel({ enhancement }: AiEnhancementPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("brief");

  return (
    <div className="mt-8 rounded-2xl border border-orange/20 bg-warm-black/60 overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="px-6 py-4 border-b border-orange/10 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-orange/15 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-bold text-foreground">Claude&apos;s Analysis</h4>
          <p className="text-xs text-foreground/40">AI-enhanced brief and site specification</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-orange/10">
        <button
          type="button"
          onClick={() => setActiveTab("brief")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "brief"
              ? "text-orange border-b-2 border-orange"
              : "text-foreground/40 hover:text-foreground/70"
          }`}
        >
          Polished Brief
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("spec")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === "spec"
              ? "text-orange border-b-2 border-orange"
              : "text-foreground/40 hover:text-foreground/70"
          }`}
        >
          Site Spec
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "brief" ? (
          <div className="animate-slide-in-right">
            <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
              {enhancement.refinedBrief}
            </pre>
          </div>
        ) : (
          <div className="animate-slide-in-right space-y-6">
            {/* Hero Copy */}
            <div className="rounded-xl bg-orange/5 border border-orange/10 p-4">
              <p className="text-xs font-semibold text-orange uppercase tracking-widest mb-2">Hero Section</p>
              <p className="text-lg font-bold text-foreground mb-1">{enhancement.siteSpec.headline}</p>
              <p className="text-sm text-foreground/60">{enhancement.siteSpec.subheadline}</p>
            </div>

            {/* SEO */}
            <div>
              <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-1">SEO Description</p>
              <p className="text-sm text-foreground/70 italic">{enhancement.siteSpec.seoDescription}</p>
              <p className="text-xs text-foreground/30 mt-1">{enhancement.siteSpec.seoDescription.length} / 160 chars</p>
            </div>

            {/* Sections */}
            <div>
              <p className="text-xs font-semibold text-foreground/40 uppercase tracking-widest mb-3">Page Sections</p>
              <div className="space-y-3">
                {enhancement.siteSpec.sections.map((section, idx) => (
                  <div key={idx} className="rounded-xl border border-orange/10 bg-warm-gray/10 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono text-orange/60 w-5 text-center">{idx + 1}</span>
                      <span className="text-sm font-bold text-foreground">{section.sectionName}</span>
                    </div>
                    <p className="text-xs text-foreground/50 mb-2 pl-7">{section.purpose}</p>
                    <p className="text-xs text-foreground/70 pl-7 leading-relaxed">{section.suggestedContent}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
