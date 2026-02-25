"use client";

import type { ProjectDescription, ValidationError } from "@/agents/project-intake";
import { FormField, inputClass } from "../FormField";

interface ProjectDescStepProps {
  data: ProjectDescription;
  errors: ValidationError[];
  onChange: (patch: Partial<ProjectDescription>) => void;
}

const textareaClass =
  "w-full bg-warm-gray/40 border border-orange/15 rounded-xl px-4 py-3 text-foreground placeholder:text-foreground/30 focus:border-orange/50 focus:outline-none focus:ring-1 focus:ring-orange/20 transition-colors text-sm resize-y min-h-[80px]";

export function ProjectDescStep({ data, errors, onChange }: ProjectDescStepProps) {
  const errorMap = Object.fromEntries(errors.map((e) => [e.field, e.message]));

  return (
    <div className="space-y-5 animate-slide-in-right">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground mb-1">Describe your project</h3>
        <p className="text-foreground/40 text-sm">What should your one-page app do?</p>
      </div>

      <FormField
        label="Project Description"
        required
        error={errorMap.description}
        hint={`${data.description.length}/2000 characters`}
      >
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Tell us what your business does and what you need the website to convey..."
          className={textareaClass}
          rows={3}
          maxLength={2000}
        />
      </FormField>

      <FormField
        label="Site Goals"
        required
        error={errorMap.goals}
        hint="What should visitors do on your site?"
      >
        <textarea
          value={data.goals}
          onChange={(e) => onChange({ goals: e.target.value })}
          placeholder="e.g. Learn about our services, call for a quote, see our menu..."
          className={textareaClass}
          rows={2}
          maxLength={500}
        />
      </FormField>

      <FormField
        label="Primary Call-to-Action"
        required
        error={errorMap.callToAction}
        hint="The main action button on your site"
      >
        <input
          type="text"
          value={data.callToAction}
          onChange={(e) => onChange({ callToAction: e.target.value })}
          placeholder="e.g. Call Now, Book Appointment, Order Online"
          className={inputClass}
          maxLength={100}
        />
      </FormField>

      <FormField
        label="Content"
        hint="Paste text you want on the site, or describe what you need"
      >
        <textarea
          value={data.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="About us text, service descriptions, menu items, hours of operation..."
          className={textareaClass}
          rows={3}
        />
      </FormField>

      <FormField label="Image Notes" hint="Describe images you'll provide or want us to source">
        <input
          type="text"
          value={data.imageNotes}
          onChange={(e) => onChange({ imageNotes: e.target.value })}
          placeholder="e.g. I'll send photos of the shop, need stock photos of bread..."
          className={inputClass}
        />
      </FormField>
    </div>
  );
}
