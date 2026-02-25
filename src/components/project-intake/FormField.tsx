"use client";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export function FormField({ label, required, error, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground/70">
        {label}
        {required && <span className="text-orange ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {hint && !error && <p className="text-foreground/30 text-xs">{hint}</p>}
    </div>
  );
}

/* Shared input class string for consistent styling */
export const inputClass =
  "w-full bg-warm-gray/40 border border-orange/15 rounded-xl px-4 py-3 text-foreground placeholder:text-foreground/30 focus:border-orange/50 focus:outline-none focus:ring-1 focus:ring-orange/20 transition-colors text-sm";

export const selectClass =
  "w-full bg-warm-gray/40 border border-orange/15 rounded-xl px-4 py-3 text-foreground focus:border-orange/50 focus:outline-none focus:ring-1 focus:ring-orange/20 transition-colors text-sm appearance-none";
