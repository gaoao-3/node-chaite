"use client";

import * as React from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { Composer, type ComposerSendOptions } from "@/components/chat/composer";
import { MessageStream } from "@/components/chat/message-stream";
import { useAgentSession } from "@/hooks/use-agent-session";
import type { AgentSessionInfo } from "@/lib/types";
import { InspectorDrawer, type InspectorTab } from "@/components/chat/inspector-drawer";
import { WorkspaceDrawer } from "@/components/workspace/workspace-drawer";
import type { EvolutionData, FusionData } from "@/hooks/use-boards";
import type { UseApprovalsFeedResult } from "@/hooks/use-approvals-feed";

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
  approvalsFeed?: UseApprovalsFeedResult;
  inspectorOpen?: boolean;
  onToggleInspector?: () => void;
  inspectorTab?: InspectorTab;
  onInspectorTabChange?: (tab: InspectorTab) => void;
  onOpenSettingsTab?: (tab: "channels" | "skills" | "mcp" | "plugins") => void;
}

export function ChatWorkspace({
  token,
  session,
  preview,
  onMenu,
  onUnauthorized,
  onSessionsChanged,
  onRename,
  onOpenApprovals: _onOpenApprovals,
  onExitPreview,
  autoScroll,
  onCreateSession,
  fusionData,
  evolutionData,
  approvalsFeed,
  inspectorOpen: controlledOpen,
  onToggleInspector: controlledToggle,
  inspectorTab: controlledTab,
  onInspectorTabChange: controlledTabChange,
  onOpenSettingsTab,
}: ChatWorkspaceProps) {
  const agent = useAgentSession({
    token,
    sessionId: session?.id ?? null,
    preview,
    onUnauthorized,
    onTitleChange: () => onSessionsChanged(),
  });
  const [draft, setDraft] = React.useState("");

  // Internal inspector drawer state if not controlled
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [workspaceOpen, setWorkspaceOpen] = React.useState(false);
  const [internalTab, setInternalTab] = React.useState<InspectorTab>("plugins");

  const effectiveInspectorOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const effectiveInspectorTab = controlledTab !== undefined ? controlledTab : internalTab;

  const handleToggleInspector = React.useCallback(() => {
    setWorkspaceOpen(false);
    if (controlledToggle) {
      controlledToggle();
    } else {
      setInternalOpen((v) => !v);
    }
  }, [controlledToggle]);

  const handleCloseInspector = React.useCallback(() => {
    if (controlledToggle && controlledOpen) {
      controlledToggle();
    } else {
      setInternalOpen(false);
    }
  }, [controlledOpen, controlledToggle]);

  const handleToggleWorkspace = React.useCallback(() => {
    setWorkspaceOpen((value) => !value);
    if (effectiveInspectorOpen) handleCloseInspector();
  }, [effectiveInspectorOpen, handleCloseInspector]);

  const handleTabChange = React.useCallback(
    (tab: InspectorTab) => {
      if (controlledTabChange) {
        controlledTabChange(tab);
      } else {
        setInternalTab(tab);
      }
    },
    [controlledTabChange],
  );

  React.useEffect(() => {
    setDraft("");
  }, [session?.id]);

  React.useEffect(() => {
    if (!agent.view.isStreaming) {
      void fusionData.refresh();
    }
  }, [agent.view.isStreaming, fusionData]);

  const liveSession = React.useMemo<AgentSessionInfo | null>(() => {
    if (preview && agent.view.session) return agent.view.session;
    if (!agent.view.session) return session;
    if (!session) return agent.view.session;
    return agent.view.session;
  }, [agent.view.session, preview, session]);

  const latestUsage = React.useMemo(() => {
    if (agent.view.usage) return agent.view.usage;
    for (let i = agent.view.timeline.length - 1; i >= 0; i--) {
      const item = agent.view.timeline[i];
      if (item.kind === "assistant" && item.usage) {
        return item.usage;
      }
    }
    return undefined;
  }, [agent.view.timeline, agent.view.usage]);
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
      if (options?.fusionMode) {
        finalPrompt = `[双星协同模式: 请由主脑制定架构方案与验收条件，并必须调用 delegate_fusion_task 工具委派副手模型执行代码并生成 Diff 补丁进行交叉审计] ${finalPrompt}`;
      }

      const imageAttachments = options?.attachments
        ?.filter(a => a.type === "image" && a.dataUrl)
        .map(a => ({ base64: a.dataUrl, url: a.dataUrl }));

      if (!finalPrompt.trim() && imageAttachments?.length) {
        finalPrompt = "分享了一张图片";
      }
      const targetModel = options?.model || overrideModel || liveSession?.model;
      if (options?.model) {
        setOverrideModel(options.model);
      }

      if (!session) {
        if (onCreateSession) {
          const created = await onCreateSession({
            platform: "web",
            title: "新会话",
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
      const ok = await onRename(session.id, title);
      if (ok) agent.refresh();
      return ok;
    },
    [agent, onRename, session],
  );

  return (
    <div className="relative z-10 flex min-w-0 flex-1 overflow-hidden">
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.02),transparent_70%)]" />

        <ChatHeader
          session={liveSession}
          connection={agent.connection}
          pendingCount={approvalsFeed ? approvalsFeed.approvals.length : agent.pendingApprovals.length}
          skillCount={liveSession?.skills.length ?? 0}
          model={liveSession?.model}
          onMenu={onMenu}
          onRename={rename}
          onRefresh={agent.refresh}
          onOpenApprovals={() => {
            handleTabChange("approvals");
            if (!effectiveInspectorOpen) handleToggleInspector();
          }}
          onCreateSession={onCreateSession ? () => void onCreateSession({ platform: "web", title: "新会话" }) : undefined}
          onToggleInspector={handleToggleInspector}
          inspectorOpen={effectiveInspectorOpen}
          onToggleWorkspace={handleToggleWorkspace}
          workspaceOpen={workspaceOpen}
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
          usage={latestUsage}
        />
      </main>

      <InspectorDrawer
        open={effectiveInspectorOpen}
        tab={effectiveInspectorTab}
        onTabChange={handleTabChange}
        onClose={handleCloseInspector}
        token={token}
        fusionData={fusionData}
        evolutionData={evolutionData}
        approvalsFeed={approvalsFeed}
        skillCount={liveSession?.skills.length ?? 0}
        onOpenSettingsTab={onOpenSettingsTab}
      />
      <WorkspaceDrawer
        open={workspaceOpen}
        token={token}
        onClose={() => setWorkspaceOpen(false)}
      />
    </div>
  );
}
