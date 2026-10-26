"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronRight, Eye, EyeOff, Loader2, PlugZap, Radio, RefreshCw, Save, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchGatewayConfigs,
  reloadGateway,
  saveGatewayConfig,
  startGateway,
  stopGateway,
  testGateway,
  type GatewayConfig,
  type GatewayInfo,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export function GatewayCard({ gateway, token, onChanged }: { gateway: GatewayInfo; token: string | null; onChanged: () => void }) {
  const [expanded, setExpanded] = React.useState(false);
  const [config, setConfig] = React.useState<GatewayConfig | null>(null);
  const [form, setForm] = React.useState({ wsUrl: "ws://127.0.0.1:3001", httpUrl: "http://127.0.0.1:3004", botQq: "", ownerQq: "", wsToken: "", httpToken: "" });
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [notice, setNotice] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [showWsToken, setShowWsToken] = React.useState(false);
  const [showHttpToken, setShowHttpToken] = React.useState(false);

  React.useEffect(() => {
    if (!expanded || !token) return;
    setLoading(true);
    fetchGatewayConfigs(token).then(list => {
      const item = list.find(x => x.id === gateway.id);
      if (item) {
        setConfig(item);
        setForm(prev => ({
          ...prev,
          wsUrl: item.settings.wsUrl || prev.wsUrl,
          httpUrl: item.settings.httpUrl || prev.httpUrl,
          botQq: item.settings.botQq || prev.botQq,
          ownerQq: item.settings.ownerQq || prev.ownerQq,
        }));
      }
    }).catch(err => setNotice({ ok: false, text: err.message })).finally(() => setLoading(false));
  }, [expanded, gateway.id, token]);

  const save = async () => {
    if (!token) return;
    setSaving(true); setNotice(null);
    try {
      await saveGatewayConfig(token, gateway.id, {
        id: gateway.id, name: gateway.name, platform: gateway.platform, enabled: true,
        settings: { wsUrl: form.wsUrl, httpUrl: form.httpUrl, botQq: form.botQq, ownerQq: form.ownerQq, wsToken: form.wsToken, httpToken: form.httpToken },
      });
      setNotice({ ok: true, text: "配置已保存，点击「热重载」应用连接参数。" });
      onChanged();
    } catch (err) { setNotice({ ok: false, text: err instanceof Error ? err.message : "保存失败" }); }
    finally { setSaving(false); }
  };

  const test = async () => {
    if (!token) return;
    setTesting(true); setNotice(null);
    try {
      const result = await testGateway(token, gateway.id);
      setNotice({ ok: result.success, text: result.success ? `探测成功：WS ${result.wsReachable ? "正常" : "不可用"} · HTTP ${result.httpReachable ? "正常" : "不可用"}${result.botNickname ? ` · ${result.botNickname}` : ""}` : result.error || "连接失败" });
    } catch (err) { setNotice({ ok: false, text: err instanceof Error ? err.message : "探测失败" }); }
    finally { setTesting(false); }
  };

  const reload = async () => {
    if (!token) return;
    setSaving(true); setNotice(null);
    try {
      await reloadGateway(token, gateway.id);
      setNotice({ ok: true, text: "网关已热重载。" });
      onChanged();
    } catch (err) { setNotice({ ok: false, text: err instanceof Error ? err.message : "重载失败" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-xs">
      <div className="flex items-center gap-2 p-2.5">
        <Radio className={cn("h-3.5 w-3.5 shrink-0", gateway.status === "running" ? "text-emerald-500" : gateway.status === "error" ? "text-rose-500" : "text-[var(--text-dim)]")} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold text-[var(--text)]">{gateway.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] text-[var(--text-dim)]">
            <span>{gateway.platform.toUpperCase()}</span><span>·</span><span className={gateway.status === "running" ? "text-emerald-600 dark:text-emerald-400" : ""}>{gateway.status}</span><span>·</span><span>{gateway.messageCount} 条消息</span>
          </div>
        </div>
        <button type="button" title="网关设置" aria-label="网关设置" onClick={() => setExpanded(v => !v)} className={cn("flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]", expanded && "bg-[var(--bg-selected)] text-[var(--accent)]")}>
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
        </button>
        <Button size="xs" variant={gateway.status === "running" ? "subtle" : "primary"} onClick={async () => { if (!token) return; await (gateway.status === "running" ? stopGateway(token, gateway.id) : startGateway(token, gateway.id)); onChanged(); }} className="h-7 text-[10px]">
          {gateway.status === "running" ? "停止" : "启动"}
        </Button>
      </div>

      {expanded ? (
        <div className="space-y-2.5 border-t border-[var(--border)] bg-[var(--bg)] p-3 text-[11px]">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-dim)]"><PlugZap className="h-3 w-3" />连接参数 · Token 留空表示保持原值</div>
          {loading ? <div className="py-3 text-center text-[var(--text-dim)]"><Loader2 className="inline h-3 w-3 animate-spin" /> 加载配置…</div> : (
            <>
              <label className="block"><span className="text-[10px] text-[var(--text-muted)]">OneBot WebSocket</span><input value={form.wsUrl} onChange={e => setForm(p => ({ ...p, wsUrl: e.target.value }))} className="mt-1 h-7 w-full rounded border border-[var(--border)] bg-[var(--bg-panel)] px-2 font-mono text-[10px] text-[var(--text)] outline-none focus:border-[var(--accent)]" /></label>
              <label className="block"><span className="text-[10px] text-[var(--text-muted)]">OneBot HTTP API</span><input value={form.httpUrl} onChange={e => setForm(p => ({ ...p, httpUrl: e.target.value }))} className="mt-1 h-7 w-full rounded border border-[var(--border)] bg-[var(--bg-panel)] px-2 font-mono text-[10px] text-[var(--text)] outline-none focus:border-[var(--accent)]" /></label>
              <div className="grid grid-cols-2 gap-2">
                <label><span className="text-[10px] text-[var(--text-muted)]">机器人 QQ</span><input value={form.botQq} onChange={e => setForm(p => ({ ...p, botQq: e.target.value }))} className="mt-1 h-7 w-full rounded border border-[var(--border)] bg-[var(--bg-panel)] px-2 font-mono text-[10px] text-[var(--text)] outline-none focus:border-[var(--accent)]" /></label>
                <label><span className="text-[10px] text-[var(--text-muted)]">管理员 QQ</span><input value={form.ownerQq} onChange={e => setForm(p => ({ ...p, ownerQq: e.target.value }))} className="mt-1 h-7 w-full rounded border border-[var(--border)] bg-[var(--bg-panel)] px-2 font-mono text-[10px] text-[var(--text)] outline-none focus:border-[var(--accent)]" /></label>
              </div>
              <label className="relative block"><span className="text-[10px] text-[var(--text-muted)]">WS Token {config?.credentials?.wsTokenConfigured ? "（已配置，留空保持）" : ""}</span><input type={showWsToken ? "text" : "password"} value={form.wsToken} onChange={e => setForm(p => ({ ...p, wsToken: e.target.value }))} placeholder="留空保持原 Token" className="mt-1 h-7 w-full rounded border border-[var(--border)] bg-[var(--bg-panel)] px-2 pr-7 font-mono text-[10px] text-[var(--text)] outline-none focus:border-[var(--accent)]" /><button type="button" onClick={() => setShowWsToken(v => !v)} className="absolute bottom-1 right-1.5 text-[var(--text-dim)]">{showWsToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button></label>
              <label className="relative block"><span className="text-[10px] text-[var(--text-muted)]">HTTP Token {config?.credentials?.httpTokenConfigured ? "（已配置，留空保持）" : ""}</span><input type={showHttpToken ? "text" : "password"} value={form.httpToken} onChange={e => setForm(p => ({ ...p, httpToken: e.target.value }))} placeholder="留空保持原 Token" className="mt-1 h-7 w-full rounded border border-[var(--border)] bg-[var(--bg-panel)] px-2 pr-7 font-mono text-[10px] text-[var(--text)] outline-none focus:border-[var(--accent)]" /><button type="button" onClick={() => setShowHttpToken(v => !v)} className="absolute bottom-1 right-1.5 text-[var(--text-dim)]">{showHttpToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button></label>
              {notice ? <div className={cn("rounded border px-2 py-1 text-[10px]", notice.ok ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300")}>{notice.text}</div> : null}
              <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-2">
                <Button size="xs" variant="primary" disabled={saving} onClick={() => void save()}><Save className="h-3 w-3" />保存配置</Button>
                <Button size="xs" variant="subtle" disabled={testing} onClick={() => void test()}>{testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Radio className="h-3 w-3" />}测试连通</Button>
                <Button size="xs" variant="subtle" disabled={saving} onClick={() => void reload()}><RefreshCw className="h-3 w-3" />热重载</Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
