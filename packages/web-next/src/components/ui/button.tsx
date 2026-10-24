import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "subtle"
  | "danger"
  | "outline";

export type ButtonSize = "xs" | "sm" | "md" | "icon" | "icon-sm";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-white/20 bg-white text-zinc-950 font-semibold shadow-sm hover:bg-zinc-100 active:bg-zinc-200 transition-colors",
  secondary:
    "border border-white/[0.09] bg-white/[0.045] text-mist-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-white/[0.14] hover:bg-white/[0.075] hover:text-white active:bg-white/[0.06]",
  ghost: "border border-transparent text-mist-400 hover:bg-white/[0.055] hover:text-mist-100",
  subtle:
    "border border-white/[0.06] bg-white/[0.025] text-mist-300 hover:border-white/[0.11] hover:bg-white/[0.05] hover:text-white",
  danger:
    "border border-rose-400/30 bg-rose-500/15 text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-rose-300/45 hover:bg-rose-500/25",
  outline:
    "border border-white/[0.12] bg-white/[0.03] text-mist-200 hover:border-white/[0.2] hover:bg-white/[0.07]",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "h-7 rounded-lg px-2.5 text-[11.5px] gap-1.5",
  sm: "h-[34px] rounded-[10px] px-3 text-[12.5px] gap-1.5",
  md: "h-10 rounded-xl px-4 text-[13px] gap-2",
  icon: "h-10 w-10 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-[9px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", loading = false, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type={props.type ?? "button"}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium tracking-[-0.005em] transition-[background,color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
