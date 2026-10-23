"use client";

import * as React from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Radio, ShieldCheck, Sparkles } from "lucide-react";
import { BrandLockup, BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthState } from "@/hooks/use-auth";

export function AuthGate({ auth }: { auth: AuthState }) {
  const [password, setPassword] = React.useState("admin123456");
  const [visible, setVisible] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim() || auth.loading) return;
    await auth.login(password);
  };

  return (
    <div className="relative flex h-dvh w-full items-center justify-center overflow-hidden px-5">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-[62%] rounded-full bg-violet-500/[0.13] blur-[120px]" />
      <div className="pointer-events-none absolute left-[62%] top-[58%] h-[320px] w-[320px] rounded-full bg-cyan-400/[0.07] blur-[100px]" />

      <div className="relative z-10 grid w-full max-w-[940px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden flex-col lg:flex">
          <BrandLockup />
          <h1 className="mt-10 max-w-md text-[38px] font-semibold leading-[1.12] tracking-[-0.045em] text-mist-100">
            一个控制台，
            <br />
            <span className="text-gradient">调度所有智能体。</span>
          </h1>
          <p className="mt-5 max-w-sm text-[13.5px] leading-6 text-mist-400">
            跨 QQ、DSH 与 Web 的会话事件流，实时工具调用、思考过程与安全审批，在同一个工作台内完成。
          </p>

          <div className="mt-9 grid max-w-md grid-cols-2 gap-2.5">
            {[
              { icon: Radio, title: "Live SSE", text: "断线续传 · Last-Event-ID" },
              { icon: ShieldCheck, title: "Human-in-loop", text: "高危操作逐项审批" },
              { icon: Sparkles, title: "Fusion", text: "主副手协同与评审" },
              { icon: LockKeyhole, title: "Local token", text: "Bearer 仅存于本机" },
            ].map((feature) => (
              <div
                key={feature.title}
                className="panel flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:border-white/[0.1]"
              >
                <feature.icon className="mt-0.5 h-3.5 w-3.5 text-violet-300/80" />
                <div>
                  <div className="text-[11.5px] font-medium text-mist-200">{feature.title}</div>
                  <div className="mt-0.5 text-[10px] text-mist-600">{feature.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[380px] animate-fade-up">
          <div className="pointer-events-none absolute -inset-10 rounded-full bg-violet-500/[0.08] blur-3xl" />
          <div className="glass-strong relative overflow-hidden rounded-[26px] border border-white/[0.09] p-6 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.95)]">
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/70 to-transparent" />
            <div className="flex items-center justify-between lg:hidden">
              <BrandLockup compact />
            </div>
            <div className="mt-1 hidden items-center justify-between lg:flex">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/[0.09]">
                <BrandMark size={28} />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-2 py-1 text-[9.5px] font-medium text-emerald-200/90">
                <span className="h-1 w-1 animate-pulse-soft rounded-full bg-emerald-300" />
                127.0.0.1:3200
              </span>
            </div>

            <div className="mt-5">
              <h2 className="text-[19px] font-semibold tracking-[-0.025em] text-mist-100">
                连接你的智能体控制台
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-mist-500">
                输入管理员口令，换取短期 JWT 并建立 SSE 事件流。
              </p>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-3.5">
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-[10.5px] font-medium uppercase tracking-[0.14em] text-mist-500">
                  管理员口令
                  <span className="normal-case tracking-normal text-mist-600">默认 admin123456</span>
                </span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-600" />
                  <Input
                    type={visible ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (auth.error) auth.clearError();
                    }}
                    autoComplete="current-password"
                    spellCheck={false}
                    placeholder="输入访问口令"
                    className="h-11 pl-9 pr-10 font-mono text-[12.5px] tracking-[0.02em]"
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((value) => !value)}
                    aria-label={visible ? "隐藏口令" : "显示口令"}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-mist-600 transition-colors hover:bg-white/[0.06] hover:text-mist-300"
                  >
                    {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </label>

              {auth.error ? (
                <div className="animate-fade-in rounded-xl border border-rose-400/20 bg-rose-400/[0.08] px-3 py-2 text-[11.5px] leading-relaxed text-rose-200">
                  {auth.error}
                </div>
              ) : null}

              <Button type="submit" variant="primary" size="md" loading={auth.loading} className="w-full">
                {!auth.loading ? <ArrowRight className="h-4 w-4" /> : null}
                进入控制台
              </Button>
            </form>

            <div className="mt-5 flex items-center gap-2 border-t border-white/[0.06] pt-4 text-[10.5px] leading-relaxed text-mist-600">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-300/70" />
              <span>口令不会离开本机；JWT 存放于 localStorage，可通过设置面板随时清除。</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
