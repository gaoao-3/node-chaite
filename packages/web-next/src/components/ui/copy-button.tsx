"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}

export function CopyButton({ value, label = "复制", className, iconOnly = false }: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const copy = React.useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement("textarea");
        area.value = value;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "已复制" : label}
      aria-label={copied ? "已复制" : label}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent text-mist-500 transition-colors hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-mist-200",
        iconOnly ? "h-6.5 w-6.5" : "h-6.5 px-1.5 text-[10.5px]",
        copied && "text-emerald-300 hover:text-emerald-200",
        className,
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {!iconOnly ? <span>{copied ? "已复制" : label}</span> : null}
    </button>
  );
}
