"use client";

import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-40",
        checked
          ? "bg-emerald-500 shadow-[0_0_12px_-2px_rgba(16,185,129,0.4)]"
          : "bg-white/[0.12] hover:bg-white/[0.18]",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/25 p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1 text-[11px] font-medium transition-colors",
            value === option.value
              ? "bg-white/[0.12] text-mist-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              : "text-mist-500 hover:text-mist-300",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
