"use client";

import type { StylePreferences, ValidationError } from "@/agents/project-intake";
import { STYLE_PRESETS } from "@/agents/project-intake";
import { FormField, inputClass } from "../FormField";
import { ColorPicker } from "../ColorPicker";

interface StyleStepProps {
  data: StylePreferences;
  errors: ValidationError[];
  onChange: (patch: Partial<StylePreferences>) => void;
}

const textareaClass =
  "w-full bg-warm-gray/40 border border-orange/15 rounded-xl px-4 py-3 text-foreground placeholder:text-foreground/30 focus:border-orange/50 focus:outline-none focus:ring-1 focus:ring-orange/20 transition-colors text-sm resize-y min-h-[80px]";

export function StyleStep({ data, errors, onChange }: StyleStepProps) {
  const errorMap = Object.fromEntries(errors.map((e) => [e.field, e.message]));

  return (
    <div className="space-y-5 animate-slide-in-right">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground mb-1">Choose your style</h3>
        <p className="text-foreground/40 text-sm">Pick a look that matches your brand.</p>
      </div>

      {/* Style Preset Grid */}
      <div>
        <p className="text-sm font-medium text-foreground/70 mb-3">Style Preset</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                const patch: Partial<StylePreferences> = { stylePreset: preset.id };
                // Set default colors from preset
                if (preset.colors.length >= 2) {
                  patch.primaryColor = preset.colors[0];
                  patch.secondaryColor = preset.colors[1];
                }
                onChange(patch);
              }}
              className={`p-4 rounded-xl border text-left transition-all ${
                data.stylePreset === preset.id
                  ? "border-orange/50 bg-orange/5"
                  : "border-orange/10 bg-warm-gray/20 hover:border-orange/30"
              }`}
            >
              <p className="text-sm font-medium text-foreground mb-2">{preset.label}</p>
              {preset.colors.length > 0 ? (
                <div className="flex gap-1.5">
                  {preset.colors.map((c, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full border border-foreground/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <div className="w-6 h-6 rounded-full border-2 border-dashed border-foreground/20" />
                  <div className="w-6 h-6 rounded-full border-2 border-dashed border-foreground/20" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Color Pickers */}
      {data.stylePreset === "custom" && (
        <div className="space-y-4 p-4 rounded-xl border border-orange/10 bg-warm-gray/20">
          <ColorPicker
            label="Primary Color"
            value={data.primaryColor}
            onChange={(c) => onChange({ primaryColor: c })}
          />
          {errorMap.primaryColor && (
            <p className="text-red-400 text-xs">{errorMap.primaryColor}</p>
          )}
          <ColorPicker
            label="Secondary Color"
            value={data.secondaryColor}
            onChange={(c) => onChange({ secondaryColor: c })}
          />
          {errorMap.secondaryColor && (
            <p className="text-red-400 text-xs">{errorMap.secondaryColor}</p>
          )}
        </div>
      )}

      <FormField label="Style Notes" hint="Any specific look or feel you want">
        <textarea
          value={data.styleNotes}
          onChange={(e) => onChange({ styleNotes: e.target.value })}
          placeholder="e.g. Clean and modern, warm and inviting, professional but approachable..."
          className={textareaClass}
          rows={2}
        />
      </FormField>

      <FormField label="Inspiration" hint="URLs of sites whose design you like">
        <input
          type="text"
          value={data.inspirationUrls}
          onChange={(e) => onChange({ inspirationUrls: e.target.value })}
          placeholder="e.g. https://example.com, https://another-site.com"
          className={inputClass}
        />
      </FormField>
    </div>
  );
}
