"use client";

import * as React from "react";
import { ApprovalsBoard } from "@/components/boards/approvals-board";
import { EvolutionBoard } from "@/components/boards/evolution-board";
import { FusionBoard } from "@/components/boards/fusion-board";
import { SettingsBoard } from "@/components/boards/settings-board";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { AuthGate } from "@/components/auth-gate";
import { BrandLockup, BrandMark } from "@/components/brand";
import { NewSessionDialog } from "@/components/new-session-dialog";
import { Sidebar } from "@/components/sidebar";
import { useApprovalsFeed } from "@/hooks/use-approvals-feed";
import { useAuth } from "@/hooks/use-auth";
import { useEvolutionData, useFusionData } from "@/hooks/use-boards";
import { usePreferences } from "@/hooks/use-preferences";
import { useSessions } from "@/hooks/use-sessions";
import { isConsoleView, type ConsoleView } from "@/lib/views";
import type { GatewayPlatform } from "@/lib/types";

const SIDEBAR_KEY = "chaite.console.sidebar-collapsed";

function BootScreen() {
  return (
    <div className="relative flex h-dvh w-full flex-col items-center justify-center gap-4 overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/[0.12] blur-[80px]" />
      <div className="relative animate-float">
        <BrandMark size={54} />
      </div>
      <BrandLockup compact />
      <div className="mt-2 h-px w-32 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full w-1/2 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(167,139,250,0.9),transparent)]" />
      </div>
    </div>
  );
}

export function AppShell() {
  const auth = useAuth();
  const preferences = usePreferences();
  const [view, setView] = React.useState<ConsoleView>("chat");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [newSessionOpen, setNewSessionOpen] = React.useState(false);

  const handleUnauthorized = React.useCallback(() => auth.logout(), [auth.logout]);

  const sessionStore = useSessions({ token: auth.token, onUnauthorized: handleUnauthorized });
  const approvalsFeed = useApprovalsFeed({
    token: auth.token,
    onUnauthorized: handleUnauthorized,
    onChanged: () => void sessionStore.refresh({ quiet: true }),
  });
  const fusion = useFusionData(auth.token, handleUnauthorized);
  const evolution = useEvolutionData(auth.token, handleUnauthorized);
  const activeSession = React.useMemo(
    () => sessionStore.sessions.find((session) => session.id === selectedId) ?? null,
    [selectedId, sessionStore.sessions],
  );

  React.useEffect(() => {
    if (!preferences.ready) return;
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      // ignore
    }
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (isConsoleView(hash)) setView(hash);
  }, [preferences.ready]);

  React.useEffect(() => {
    if (!preferences.ready) return;
    try {
      window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed, preferences.ready]);

  React.useEffect(() => {
    window.history.replaceState(null, "", `#${view}`);
  }, [view]);

  React.useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, "");
      if (isConsoleView(hash)) setView(hash);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  React.useEffect(() => {
    if (sessionStore.sessions.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !sessionStore.sessions.some((session) => session.id === selectedId)) {
      setSelectedId(sessionStore.sessions[0].id);
    }
  }, [selectedId, sessionStore.sessions]);

  const changeView = React.useCallback((next: ConsoleView) => {
    setView(next);
    setMobileOpen(false);
  }, []);

  const selectSession = React.useCallback((sessionId: string) => {
    setSelectedId(sessionId);
    setView("chat");
    setMobileOpen(false);
  }, []);

  const createSession = React.useCallback(
    async (input: { platform: GatewayPlatform; title: string; model?: string }) => {
      const session = await sessionStore.createSession(input);
      if (!session) return false;
      setSelectedId(session.id);
      setView("chat");
      setMobileOpen(false);
      return true;
    },
    [sessionStore],
  );

  const renameSession = React.useCallback(
    async (sessionId: string, title: string) => sessionStore.renameSession(sessionId, title),
    [sessionStore],
  );

  const reconnectAll = React.useCallback(() => {
    void sessionStore.refresh({ quiet: true });
    void approvalsFeed.refresh();
    void fusion.refresh();
    void evolution.refresh();
  }, [approvalsFeed, evolution, fusion, sessionStore]);

  const exitPreview = React.useCallback(() => {
    preferences.update({ preview: false });
  }, [preferences]);

  if (!auth.ready) return <BootScreen />;
  if (!auth.token) return <AuthGate auth={auth} />;

  return (
    <div
      data-density={preferences.preferences.density}
      className={preferences.preferences.reduceMotion ? "reduce-motion" : undefined}
    >
      <div className="relative z-10 flex h-dvh w-full overflow-hidden">
        {mobileOpen ? (
          <button
            type="button"
            aria-label="关闭会话侧边栏"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[3px] md:hidden animate-fade-in"
          />
        ) : null}

        <Sidebar
          sessions={sessionStore.sessions}
          stats={sessionStore.stats}
          selectedId={selectedId}
          view={view}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          loading={sessionStore.loading}
          refreshing={sessionStore.refreshing}
          error={sessionStore.error}
          approvalCount={approvalsFeed.approvals.length}
          onSelect={selectSession}
          onCreate={() => setNewSessionOpen(true)}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onCloseMobile={() => setMobileOpen(false)}
          onViewChange={changeView}
          onRefresh={reconnectAll}
          onLogout={auth.logout}
        />

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {view === "chat" ? (
            <ChatWorkspace
              token={auth.token}
              session={activeSession}
              preview={preferences.preferences.preview}
              onMenu={() => setMobileOpen(true)}
              onUnauthorized={handleUnauthorized}
              onSessionsChanged={() => void sessionStore.refresh({ quiet: true })}
              onRename={renameSession}
              onOpenApprovals={() => changeView("approvals")}
              onExitPreview={exitPreview}
              autoScroll={preferences.preferences.autoScroll}
            />
          ) : null}

          {view === "fusion" ? <FusionBoard data={fusion} onGoChat={() => changeView("chat")} /> : null}
          {view === "evolution" ? <EvolutionBoard data={evolution} /> : null}
          {view === "approvals" ? (
            <ApprovalsBoard
              feed={approvalsFeed}
              onOpenSession={(sessionId) => {
                selectSession(sessionId);
              }}
            />
          ) : null}
          {view === "settings" ? (
            <SettingsBoard
              preferences={preferences.preferences}
              update={preferences.update}
              reset={preferences.reset}
              token={auth.token}
              stats={sessionStore.stats}
              sessionCount={sessionStore.sessions.length}
              onLogout={auth.logout}
              onReconnect={reconnectAll}
            />
          ) : null}
        </div>
      </div>

      <NewSessionDialog
        open={newSessionOpen}
        onClose={() => setNewSessionOpen(false)}
        onCreate={createSession}
        defaultPlatform={preferences.preferences.defaultPlatform}
      />
    </div>
  );
}
