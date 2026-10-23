"use client";

import * as React from "react";
import { Plus, Sparkles } from "lucide-react";
import { PlatformIcon } from "@/components/platform-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platform";
import type { GatewayPlatform } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NewSessionDialog({
  open,
  onClose,
  onCreate,
  defaultPlatform,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { platform: GatewayPlatform; title: string; model?: string }) => Promise<boolean>;
  defaultPlatform: GatewayPlatform;
}) {
  const [platform, setPlatform] = React.useState<GatewayPlatform>(defaultPlatform);
  const [title, setTitle] = React.useState("");
  const [model, setModel] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setPlatform(defaultPlatform);
    setTitle("");
    setModel("");
    setError(null);
  }, [defaultPlatform, open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    const fallback = `${PLATFORM_META[platform].label} · ${new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date())}`;
    const ok = await onCreate({
      platform,
      title: title.trim() || fallback,
      model: model.trim() || undefined,
    });
    setCreating(false);
    if (ok) onClose();
    else setError("创建失败，请检查后端连接或稍后重试。");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新建会话"
      description="选择一个入口，Chaite 会为它创建独立的 SSE 事件流与审批队列。"
      icon={<Plus className="h-4 w-4" />}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" variant="primary" loading={creating} type="submit" form="new-session-form">
            <Sparkles className="h-3.5 w-3.5" />
            创建会话
          </Button>
        </>
      }
    >
      <form id="new-session-form" onSubmit={submit} className="space-y-3.5">
        <div>
          <div className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-mist-600">平台入口</div>
          <div className="grid grid-cols-3 gap-1.5">
            {PLATFORM_ORDER.map((key) => {
              const meta = PLATFORM_META[key];
              const active = platform === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPlatform(key)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                    active
                      ? "border-violet-300/25 bg-violet-400/[0.08]"
                      : "border-white/[0.065] bg-white/[0.02] hover:border-white/[0.11] hover:bg-white/[0.035]",
                  )}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md border"
                    style={{ color: meta.accent, borderColor: `${meta.accent}30`, backgroundColor: meta.tint }}
                  >
                    <PlatformIcon platform={key} className="h-3 w-3" />
                  </span>
                  <span className={cn("text-[10.5px] font-medium", active ? "text-mist-100" : "text-mist-300")}>
                    {meta.label}
                  </span>
                  <span className="line-clamp-2 text-[8.5px] leading-snug text-mist-600">{meta.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-mist-600">会话标题</span>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：Web 控制台调试 · SSE 巡检"
            maxLength={80}
            autoFocus
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-mist-600">
            驱动模型 <span className="font-normal normal-case tracking-normal text-mist-700">可选</span>
          </span>
          <Input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="留空则使用 ChatPreset 默认模型"
            className="font-mono text-[11px]"
          />
        </label>

        {error ? (
          <div className="rounded-lg border border-rose-400/18 bg-rose-400/[0.06] px-2.5 py-2 text-[10.5px] text-rose-200/90">
            {error}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
