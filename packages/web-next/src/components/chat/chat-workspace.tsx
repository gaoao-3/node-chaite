"use client";

import * as React from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { Composer, type ComposerSendOptions } from "@/components/chat/composer";
import { MessageStream } from "@/components/chat/message-stream";
import { useAgentSession } from "@/hooks/use-agent-session";
import type { AgentSessionInfo } from "@/lib/types";
import { InspectorDrawer, type InspectorTab } from "@/components/chat/inspector-drawer";
import type { EvolutionData, FusionData } from "@/hooks/use-boards";

export interface ChatWorkspaceProps {
  token: string | null;
  session: AgentSessionInfo | null;
  preview: boolean;
  onMenu: () => void;
  onUnauthorized: () => void;
  onSessionsChanged: () => void;
  onRename: (sessionId: string, title: string) => Promise<boolean>;
  onOpenApprovals: () => void;
  onExitPreview: () => void;
  autoScroll: boolean;
  onCreateSession?: (input?: { platform: "qq" | "dsh" | "web"; title: string; model?: string }) => Promise<AgentSessionInfo | null>;
  fusionData: FusionData;
  evolutionData: EvolutionData;
}

export function ChatWorkspace({
  token,
  session,
  preview,
  onMenu,
  onUnauthorized,
  onSessionsChanged,
  onRename,
  onOpenApprovals,
  onExitPreview,
  autoScroll,
  onCreateSession,
  fusionData,
  evolutionData,
}: ChatWorkspaceProps) {
  const agent = useAgentSession({
    token,
    sessionId: session?.id ?? null,
    preview,
    onUnauthorized,
  });
  const [draft, setDraft] = React.useState("");
  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  const [inspectorTab, setInspectorTab] = React.useState<InspectorTab>("plugins");

  React.useEffect(() => {
    setDraft("");
  }, [session?.id]);

  const liveSession = React.useMemo<AgentSessionInfo | null>(() => {
    if (preview && agent.view.session) return agent.view.session;
    if (!agent.view.session) return session;
    if (!session) return agent.view.session;
    return { ...agent.view.session, title: session.title };
  }, [agent.view.session, preview, session]);

  const [overrideModel, setOverrideModel] = React.useState<string | undefined>(undefined);
  const activeModel = overrideModel || liveSession?.model;

  const send = React.useCallback(
    async (text: string, options?: ComposerSendOptions) => {
      let finalPrompt = text;
      if (options?.attachments && options.attachments.length > 0) {
        const fileBlocks = options.attachments
          .filter(a => a.type === "file" && a.textContent)
          .map(a => `\n\n### 📎 附件: ${a.name}\n\`\`\`\n${a.textContent}\n\`\`\``)
          .join("");
        finalPrompt += fileBlocks;
      }
      if (options?.webSearch) {
        finalPrompt = `[联网搜索模式: 请检索互联网最新信息] ${finalPrompt}`;
      }
      if (options?.deepThinking) {
        finalPrompt = `[深度思考模式: 请详细展现推理推演全过程] ${finalPrompt}`;
      }

      const imageAttachments = options?.attachments
        ?.filter(a => a.type === "image" && a.dataUrl)
        .map(a => ({ base64: a.dataUrl, url: a.dataUrl }));

      const targetModel = options?.model || overrideModel || liveSession?.model;
      if (options?.model) {
        setOverrideModel(options.model);
      }

      if (!session) {
        if (onCreateSession) {
          const created = await onCreateSession({
            platform: "web",
            title: text.slice(0, 24) || "新会话",
            model: targetModel,
          });
          if (created && token) {
            try {
              const { sendPrompt } = await import("@/lib/api");
              await sendPrompt(token, created.id, {
                prompt: finalPrompt,
                model: targetModel,
                images: imageAttachments,
                thinkingLevel: options?.thinkingLevel,
              });
              onSessionsChanged();
              return true;
            } catch (err) {
              console.error("Auto send error:", err);
            }
          }
        }
        return false;
      }

      const ok = await agent.sendPrompt(finalPrompt, {
        model: targetModel,
        images: imageAttachments,
        thinkingLevel: options?.thinkingLevel,
      });
      if (ok) onSessionsChanged();
      return ok;
    },
    [agent, liveSession?.model, onCreateSession, onSessionsChanged, overrideModel, session, token],
  );

  const suggestion = React.useCallback((prompt: string) => {
    setDraft(prompt);
  }, []);

  const rename = React.useCallback(
    async (title: string) => {
      if (!session) return false;
      return onRename(session.id, title);
    },
    [onRename, session],
  );

  return (
    <div className="relative z-10 flex min-w-0 flex-1 overflow-hidden">
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-fade opacity-[0.22]" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[240px] w-[560px] -translate-x-1/2 rounded-full bg-violet-500/[0.035] blur-[80px]" />

        <ChatHeader
          session={liveSession}
          connection={agent.connection}
          pendingCount={agent.pendingApprovals.length}
          skillCount={liveSession?.skills.length ?? 0}
          model={liveSession?.model}
          onMenu={onMenu}
          onRename={rename}
          onRefresh={agent.refresh}
          onOpenApprovals={onOpenApprovals}
          onCreateSession={onCreateSession ? () => void onCreateSession({ platform: "web", title: "新会话" }) : undefined}
          onToggleInspector={() => setInspectorOpen((v) => !v)}
          inspectorOpen={inspectorOpen}
        />

        <MessageStream
          view={agent.view}
          connection={agent.connection}
          loading={agent.loading}
          preview={preview}
          hasSession={Boolean(session) || preview}
          onSuggestion={suggestion}
          onRespond={agent.respond}
          onExitPreview={onExitPreview}
          autoScroll={autoScroll}
          onCreateSession={onCreateSession ? () => void onCreateSession({ platform: "web", title: "新会话" }) : undefined}
        />

        <Composer
          value={draft}
          onChange={setDraft}
          onSend={send}
          onCancel={() => void agent.cancel()}
          disabled={preview}
          streaming={agent.view.isStreaming}
          promptPending={agent.promptPending}
          preview={preview}
          model={activeModel}
          onModelChange={(newModel) => setOverrideModel(newModel)}
          skillCount={liveSession?.skills.length ?? 0}
          error={agent.error}
          onDismissError={agent.clearError}
        />
      </main>

      <InspectorDrawer
        open={inspectorOpen}
        tab={inspectorTab}
        onTabChange={setInspectorTab}
        onClose={() => setInspectorOpen(false)}
        token={token}
        fusionData={fusionData}
        evolutionData={evolutionData}
        skillCount={liveSession?.skills.length ?? 0}
      />
    </div>
  );
}
