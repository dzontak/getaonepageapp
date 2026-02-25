"use client";

const PRESET_COLORS = [
  "#F07D2E", "#E53E3E", "#DD6B20", "#D69E2E",
  "#38A169", "#6B8E23", "#3DA7DB", "#3182CE",
  "#805AD5", "#D53F8C", "#333333", "#718096",
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground/70">{label}</p>
      <div className="flex flex-wrap gap-2 items-center">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              value === color
                ? "border-foreground ring-2 ring-orange/30 scale-110"
                : "border-transparent hover:scale-110"
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
        <label className="relative cursor-pointer" title="Pick custom color">
          <input
            type="color"
            value={value || "#F07D2E"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
          />
          <div
            className="w-8 h-8 rounded-full border-2 border-dashed border-foreground/30 flex items-center justify-center text-foreground/50 text-xs hover:border-orange/50 transition-colors"
            style={
              !PRESET_COLORS.includes(value) && value
                ? { backgroundColor: value, borderStyle: "solid", borderColor: "var(--foreground)" }
                : undefined
            }
          >
            {PRESET_COLORS.includes(value) || !value ? "+" : ""}
          </div>
        </label>
      </div>
      {value && (
        <p className="text-xs text-foreground/30 font-mono">{value}</p>
      )}
    </div>
  );
}
