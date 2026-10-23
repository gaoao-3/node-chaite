"use client";

import * as React from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { Composer } from "@/components/chat/composer";
import { MessageStream } from "@/components/chat/message-stream";
import { useAgentSession } from "@/hooks/use-agent-session";
import type { AgentSessionInfo } from "@/lib/types";

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
}: ChatWorkspaceProps) {
  const agent = useAgentSession({
    token,
    sessionId: session?.id ?? null,
    preview,
    onUnauthorized,
  });
  const [draft, setDraft] = React.useState("");

  React.useEffect(() => {
    setDraft("");
  }, [session?.id]);

  const liveSession = React.useMemo<AgentSessionInfo | null>(() => {
    if (preview && agent.view.session) return agent.view.session;
    if (!agent.view.session) return session;
    if (!session) return agent.view.session;
    return { ...agent.view.session, title: session.title };
  }, [agent.view.session, preview, session]);

  const send = React.useCallback(
    async (text: string) => {
      const ok = await agent.sendPrompt(text);
      if (ok) onSessionsChanged();
      return ok;
    },
    [agent, onSessionsChanged],
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
    <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
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
      />

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={send}
        onCancel={() => void agent.cancel()}
        disabled={!session && !preview}
        streaming={agent.view.isStreaming}
        promptPending={agent.promptPending}
        preview={preview}
        model={liveSession?.model}
        skillCount={liveSession?.skills.length ?? 0}
        error={agent.error}
        onDismissError={agent.clearError}
      />
    </main>
  );
}
