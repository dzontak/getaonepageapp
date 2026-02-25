"use client";

import type { ContactInfo, ValidationError } from "@/agents/project-intake";
import { FormField, inputClass } from "../FormField";

interface ContactStepProps {
  data: ContactInfo;
  errors: ValidationError[];
  onChange: (patch: Partial<ContactInfo>) => void;
}

const textareaClass =
  "w-full bg-warm-gray/40 border border-orange/15 rounded-xl px-4 py-3 text-foreground placeholder:text-foreground/30 focus:border-orange/50 focus:outline-none focus:ring-1 focus:ring-orange/20 transition-colors text-sm resize-y min-h-[80px]";

export function ContactStep({ data, errors, onChange }: ContactStepProps) {
  const errorMap = Object.fromEntries(errors.map((e) => [e.field, e.message]));

  return (
    <div className="space-y-5 animate-slide-in-right">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground mb-1">How can we reach you?</h3>
        <p className="text-foreground/40 text-sm">We&apos;ll use this to follow up on your project.</p>
      </div>

      <FormField label="Your Name" required error={errorMap.name}>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Full name"
          className={inputClass}
          maxLength={100}
        />
      </FormField>

      <FormField label="Email Address" required error={errorMap.email}>
        <input
          type="email"
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="you@example.com"
          className={inputClass}
        />
      </FormField>

      <FormField label="Phone Number" error={errorMap.phone} hint="Optional">
        <input
          type="tel"
          value={data.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="(555) 123-4567"
          className={inputClass}
        />
      </FormField>

      <div>
        <p className="text-sm font-medium text-foreground/70 mb-3">Preferred Contact Method</p>
        <div className="flex gap-3">
          {(["email", "phone", "either"] as const).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => onChange({ preferredContact: method })}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                data.preferredContact === method
                  ? "bg-orange/15 text-orange border-orange/30"
                  : "bg-warm-gray/30 text-foreground/50 border-orange/10 hover:border-orange/20"
              }`}
            >
              {method.charAt(0).toUpperCase() + method.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <FormField label="Additional Notes" hint="Anything else we should know">
        <textarea
          value={data.additionalNotes}
          onChange={(e) => onChange({ additionalNotes: e.target.value })}
          placeholder="Timeline, budget constraints, special requirements..."
          className={textareaClass}
          rows={3}
        />
      </FormField>
    </div>
  );
}
