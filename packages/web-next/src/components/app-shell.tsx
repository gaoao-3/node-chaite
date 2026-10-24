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
import type { InspectorTab } from "@/components/chat/inspector-drawer";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "chaite.console.sidebar-collapsed";

function BootScreen() {
  return (
    <div className="relative flex h-dvh w-full flex-col items-center justify-center gap-3 overflow-hidden bg-[var(--bg)]">
      <BrandMark size={42} />
      <BrandLockup compact />
      <div className="mt-1 h-0.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full w-1/2 animate-shimmer bg-accent" />
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
  const [inspectorOpen, setInspectorOpen] = React.useState(false);
  const [inspectorTab, setInspectorTab] = React.useState<InspectorTab>("plugins");
  const [settingsTab, setSettingsTab] = React.useState<"general" | "channels" | "skills" | "mcp" | "plugins">("general");

  const openChannels = React.useCallback(() => {
    setSettingsTab("channels");
    setView("settings");
    setMobileOpen(false);
  }, []);

  const openSkills = React.useCallback(() => {
    setSettingsTab("skills");
    setView("settings");
    setMobileOpen(false);
  }, []);

  const openMcp = React.useCallback(() => {
    setSettingsTab("mcp");
    setView("settings");
    setMobileOpen(false);
  }, []);

  const openPlugins = React.useCallback(() => {
    setSettingsTab("plugins");
    setView("settings");
    setMobileOpen(false);
  }, []);

  const { logout } = auth;
  const handleUnauthorized = React.useCallback(() => logout(), [logout]);

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
    if (next === "chat") {
      setView("chat");
    } else if (next === "settings") {
      setView("settings");
    } else if (next === "fusion" || next === "evolution" || next === "approvals") {
      setView("chat");
      setInspectorOpen(true);
      setInspectorTab(next);
    }
    setMobileOpen(false);
  }, []);

  const selectSession = React.useCallback((sessionId: string) => {
    setSelectedId(sessionId);
    setView("chat");
    setMobileOpen(false);
  }, []);

  const toggleSidebar = React.useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileOpen((open) => !open);
    } else {
      setCollapsed((value) => !value);
    }
  }, []);

  const createSession = React.useCallback(
    async (input?: { platform: GatewayPlatform; title: string; model?: string }) => {
      const requestedModel = input?.model ?? (preferences.preferences.defaultModel.trim() ? preferences.preferences.defaultModel : undefined);
      const session = await sessionStore.createSession({
        platform: input?.platform ?? preferences.preferences.defaultPlatform,
        title: input?.title ?? "新会话",
        model: requestedModel,
      });
      if (!session) return null;
      setSelectedId(session.id);
      setView("chat");
      setMobileOpen(false);
      return session;
    },
    [preferences.preferences.defaultPlatform, preferences.preferences.defaultModel, sessionStore],
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
      className={cn("h-full w-full", preferences.preferences.reduceMotion ? "reduce-motion" : undefined)}
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
          onToggleInspector={() => setInspectorOpen((value) => !value)}
          onOpenChannels={openChannels}
          onOpenSkills={openSkills}
          onOpenMcp={openMcp}
          onOpenPlugins={openPlugins}
        />

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {view === "chat" ? (
            <ChatWorkspace
              token={auth.token}
              session={activeSession}
              preview={preferences.preferences.preview}
              onMenu={toggleSidebar}
              onCreateSession={createSession}
              onUnauthorized={handleUnauthorized}
              onSessionsChanged={() => void sessionStore.refresh({ quiet: true })}
              onRename={renameSession}
              onOpenApprovals={() => {
                setView("chat");
                setInspectorOpen(true);
                setInspectorTab("approvals");
              }}
              onExitPreview={exitPreview}
              autoScroll={preferences.preferences.autoScroll}
              fusionData={fusion}
              evolutionData={evolution}
              approvalsFeed={approvalsFeed}
              inspectorOpen={inspectorOpen}
              onToggleInspector={() => setInspectorOpen((value) => !value)}
              inspectorTab={inspectorTab}
              onInspectorTabChange={setInspectorTab}
              onOpenSettingsTab={(tab) => {
                setSettingsTab(tab);
                setView("settings");
              }}
            />
          ) : null}

          {view === "fusion" ? <FusionBoard data={fusion} onGoChat={() => changeView("chat")} onMenu={toggleSidebar} /> : null}
          {view === "evolution" ? <EvolutionBoard data={evolution} onMenu={toggleSidebar} /> : null}
          {view === "approvals" ? (
            <ApprovalsBoard
              feed={approvalsFeed}
              onMenu={toggleSidebar}
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
              onMenu={toggleSidebar}
              onBack={() => setView("chat")}
              initialTab={settingsTab}
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
