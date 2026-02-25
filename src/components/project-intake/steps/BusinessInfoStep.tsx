"use client";

import type { BusinessInfo, ValidationError } from "@/agents/project-intake";
import { BUSINESS_TYPES } from "@/agents/project-intake";
import { FormField, inputClass, selectClass } from "../FormField";

interface BusinessInfoStepProps {
  data: BusinessInfo;
  errors: ValidationError[];
  onChange: (patch: Partial<BusinessInfo>) => void;
}

export function BusinessInfoStep({ data, errors, onChange }: BusinessInfoStepProps) {
  const errorMap = Object.fromEntries(errors.map((e) => [e.field, e.message]));

  return (
    <div className="space-y-5 animate-slide-in-right">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground mb-1">Tell us about your business</h3>
        <p className="text-foreground/40 text-sm">Basic information to get started.</p>
      </div>

      <FormField label="Business Name" required error={errorMap.businessName}>
        <input
          type="text"
          value={data.businessName}
          onChange={(e) => onChange({ businessName: e.target.value })}
          placeholder="e.g. Sunrise Bakery"
          className={inputClass}
          maxLength={100}
        />
      </FormField>

      <FormField label="Business Type" required error={errorMap.businessType}>
        <select
          value={data.businessType}
          onChange={(e) => onChange({ businessType: e.target.value as BusinessInfo["businessType"] })}
          className={selectClass}
        >
          <option value="">Select a type...</option>
          {BUSINESS_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Industry Details"
        hint="Optional — any specifics about your niche"
        error={errorMap.industry}
      >
        <input
          type="text"
          value={data.industry}
          onChange={(e) => onChange({ industry: e.target.value })}
          placeholder="e.g. Artisan bread, organic pastries"
          className={inputClass}
        />
      </FormField>

      <FormField
        label="Existing Website"
        hint="If you have one already"
        error={errorMap.website}
      >
        <input
          type="url"
          value={data.website}
          onChange={(e) => onChange({ website: e.target.value })}
          placeholder="https://..."
          className={inputClass}
        />
      </FormField>
    </div>
  );
}
