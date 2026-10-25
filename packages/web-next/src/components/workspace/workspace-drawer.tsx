"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Eye,
  EyeOff,
  FileCode2,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderTree,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import { Markdown } from "@/components/chat/markdown";
import {
  fetchWorkspaceFile,
  fetchWorkspaceTree,
  runWorkspaceCommand,
  saveWorkspaceFile,
  type WorkspaceEntry,
  type WorkspaceFile,
  type WorkspaceTerminalResult,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export interface WorkspaceDrawerProps {
  open: boolean;
  token: string | null;
  onClose: () => void;
}

type WorkspaceTab = "files" | "terminal";

interface TerminalEntry {
  id: string;
  command: string;
  cwd: string;
  result?: WorkspaceTerminalResult;
  error?: string;
  pending?: boolean;
}

interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
  entries: TerminalEntry[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WorkspaceDrawer({ open, token, onClose }: WorkspaceDrawerProps) {
  const [tab, setTab] = React.useState<WorkspaceTab>("files");
  const [expandedPanel, setExpandedPanel] = React.useState(false);
  const [showHidden, setShowHidden] = React.useState(false);
  const [tree, setTree] = React.useState<Record<string, WorkspaceEntry[]>>({});
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(["."]));
  const [loadingDirs, setLoadingDirs] = React.useState<Set<string>>(new Set());
  const [file, setFile] = React.useState<WorkspaceFile | null>(null);
  const [draft, setDraft] = React.useState("");
  const [fileMode, setFileMode] = React.useState<"source" | "preview">("source");
  const [fileLoading, setFileLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [terminals, setTerminals] = React.useState<TerminalSession[]>([
    { id: "terminal-1", title: "终端 1", cwd: ".", entries: [] },
  ]);
  const [activeTerminalId, setActiveTerminalId] = React.useState("terminal-1");
  const [command, setCommand] = React.useState("");
  const [runningId, setRunningId] = React.useState<string | null>(null);
  const outputRef = React.useRef<HTMLDivElement>(null);

  const activeTerminal = terminals.find(item => item.id === activeTerminalId) ?? terminals[0];
  const dirty = file ? draft !== file.content : false;

  const loadDirectory = React.useCallback(async (directory: string) => {
    if (!token) return;
    setLoadingDirs(previous => new Set(previous).add(directory));
    try {
      const result = await fetchWorkspaceTree(token, directory, showHidden);
      setTree(previous => ({ ...previous, [result.path]: result.entries }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "文件目录加载失败");
    } finally {
      setLoadingDirs(previous => {
        const next = new Set(previous);
        next.delete(directory);
        return next;
      });
    }
  }, [showHidden, token]);

  React.useEffect(() => {
    if (open && token && !tree["."]) void loadDirectory(".");
  }, [loadDirectory, open, token, tree]);

  React.useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [activeTerminal?.entries.length, runningId, activeTerminalId]);

  const toggleDirectory = (directory: string) => {
    setExpanded(previous => {
      const next = new Set(previous);
      if (next.has(directory)) next.delete(directory);
      else next.add(directory);
      return next;
    });
    if (!tree[directory]) void loadDirectory(directory);
  };

  const openFile = async (path: string) => {
    if (!token) return;
    setFileLoading(true);
    setNotice(null);
    try {
      const result = await fetchWorkspaceFile(token, path);
      setFile(result);
      setDraft(result.content);
      setFileMode("source");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "文件读取失败");
    } finally {
      setFileLoading(false);
    }
  };

  const saveFile = async () => {
    if (!token || !file || file.readOnly) return;
    setSaving(true);
    setNotice(null);
    try {
      await saveWorkspaceFile(token, file.path, draft);
      setFile(previous => previous ? { ...previous, content: draft, size: new TextEncoder().encode(draft).length } : previous);
      setNotice("已保存");
      window.setTimeout(() => setNotice(null), 1600);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const createFile = async () => {
    if (!token) return;
    const path = window.prompt("新建文件路径（相对于工作区，例如 notes/todo.md）", "notes/todo.md");
    if (!path?.trim()) return;
    try {
      await saveWorkspaceFile(token, path.trim(), "");
      await loadDirectory(".");
      await openFile(path.trim());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "新建文件失败");
    }
  };

  const refreshTree = () => {
    setTree({});
    setExpanded(new Set(["."]));
    setNotice(null);
  };

  const executeCommand = async (rawCommand: string) => {
    const current = activeTerminal;
    const value = rawCommand.trim();
    if (!token || !current || !value || runningId) return;
    if (value === "clear") {
      setTerminals(previous => previous.map(item => item.id === current.id ? { ...item, entries: [] } : item));
      setCommand("");
      return;
    }

    const entryId = `cmd-${Date.now()}`;
    const cwd = current.cwd;
    setTerminals(previous => previous.map(item => item.id === current.id
      ? { ...item, entries: [...item.entries, { id: entryId, command: value, cwd, pending: true }] }
      : item));
    setCommand("");
    setRunningId(current.id);

    try {
      const result = await runWorkspaceCommand(token, value, cwd);
      setTerminals(previous => previous.map(item => item.id === current.id
        ? {
            ...item,
            cwd: result.cwd,
            entries: item.entries.map(entry => entry.id === entryId ? { ...entry, result, pending: false } : entry),
          }
        : item));
    } catch (error) {
      setTerminals(previous => previous.map(item => item.id === current.id
        ? {
            ...item,
            entries: item.entries.map(entry => entry.id === entryId
              ? { ...entry, error: error instanceof Error ? error.message : "命令执行失败", pending: false }
              : entry),
          }
        : item));
    } finally {
      setRunningId(null);
    }
  };

  const createTerminal = () => {
    const id = `terminal-${Date.now()}`;
    setTerminals(previous => [...previous, { id, title: `终端 ${previous.length + 1}`, cwd: ".", entries: [] }]);
    setActiveTerminalId(id);
    setTab("terminal");
  };

  const closeTerminal = (id: string) => {
    if (terminals.length <= 1) return;
    const remaining = terminals.filter(item => item.id !== id);
    setTerminals(remaining);
    if (activeTerminalId === id) setActiveTerminalId(remaining[0].id);
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="关闭工作区"
        className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] md:hidden"
        onClick={onClose}
      />
      <aside
        aria-label="工作区"
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-[var(--border)] bg-[var(--bg)] shadow-2xl transition-[width] duration-200 md:relative md:z-20 md:shadow-none",
          expandedPanel ? "md:w-[min(1000px,90vw)]" : "md:w-[560px]",
        )}
      >
        <header className="flex h-11 shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--bg-panel)] px-2">
          <FolderTree className="ml-1 h-4 w-4 text-[var(--accent)]" />
          <span className="text-[12px] font-semibold text-[var(--text)]">工作区</span>
          <span className="ml-1 font-mono text-[9px] text-[var(--text-dim)]">WORKSPACE</span>
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setExpandedPanel(value => !value)}
              title={expandedPanel ? "恢复面板宽度" : "展开工作区"}
              className="hidden h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] md:flex"
            >
              {expandedPanel ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="关闭工作区"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2">
          <button
            type="button"
            onClick={() => setTab("files")}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] transition-colors",
              tab === "files" ? "bg-[var(--bg-selected)] text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]",
            )}
          >
            <FolderTree className="h-3.5 w-3.5" />
            文件与源码
          </button>
          <button
            type="button"
            onClick={() => setTab("terminal")}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] transition-colors",
              tab === "terminal" ? "bg-[var(--bg-selected)] text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]",
            )}
          >
            <TerminalIcon className="h-3.5 w-3.5" />
            终端
          </button>
          <span className="ml-auto font-mono text-[9px] text-[var(--text-dim)]">受控工作区</span>
        </div>

        {notice ? (
          <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--accent)]">
            <Check className="h-3 w-3" />
            <span className="truncate">{notice}</span>
          </div>
        ) : null}

        {tab === "files" ? (
          <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[172px_minmax(0,1fr)]">
            {/* File tree: lazy-loaded directories, like Pi Web's explorer. */}
            <section className="flex max-h-52 shrink-0 flex-col border-b border-[var(--border)] md:max-h-none md:border-b-0 md:border-r">
              <div className="flex h-8 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-dim)]">EXPLORER</span>
                <div className="ml-auto flex items-center gap-0.5">
                  <button type="button" onClick={createFile} title="新建文件" className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]">
                    <FilePlus2 className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => { setShowHidden(value => !value); setTree({}); }} title={showHidden ? "隐藏隐藏文件" : "显示隐藏文件"} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]">
                    {showHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </button>
                  <button type="button" onClick={refreshTree} title="刷新目录" className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]">
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto py-1">
                <div className="flex items-center gap-1 px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]">
                  <FolderOpen className="h-3 w-3 text-[var(--accent)]" />
                  <span>chaite</span>
                </div>
                <FileTreeBranch
                  path="."
                  depth={0}
                  tree={tree}
                  expanded={expanded}
                  loadingDirs={loadingDirs}
                  selectedPath={file?.path}
                  onToggleDirectory={toggleDirectory}
                  onOpenFile={path => void openFile(path)}
                />
                {!tree["."] ? <div className="px-3 py-3 text-[11px] text-[var(--text-dim)]">正在读取目录…</div> : null}
              </div>
            </section>

            {/* Source / preview viewer */}
            <section className="flex min-h-0 min-w-0 flex-1 flex-col">
              {file ? (
                <>
                  <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2">
                    <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[var(--text)]" title={file.path}>{file.path}</span>
                    {dirty ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="未保存" /> : null}
                    {file.language === "markdown" ? (
                      <div className="flex items-center rounded border border-[var(--border)] p-0.5 text-[9px]">
                        <button type="button" onClick={() => setFileMode("source")} className={cn("rounded px-1.5 py-0.5", fileMode === "source" ? "bg-[var(--bg-selected)] text-[var(--text)]" : "text-[var(--text-muted)]")}>源码</button>
                        <button type="button" onClick={() => setFileMode("preview")} className={cn("rounded px-1.5 py-0.5", fileMode === "preview" ? "bg-[var(--bg-selected)] text-[var(--text)]" : "text-[var(--text-muted)]")}>预览</button>
                      </div>
                    ) : null}
                    {!file.readOnly ? (
                      <button type="button" onClick={() => void saveFile()} disabled={saving || !dirty} title="保存文件" className="rounded p-1 text-[var(--accent)] hover:bg-[var(--bg-hover)] disabled:opacity-30">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      </button>
                    ) : null}
                    <button type="button" onClick={() => { setFile(null); setDraft(""); }} title="关闭文件" className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {file.truncated ? <div className="border-b border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-700 dark:text-amber-300">文件较大，仅显示前 512 KiB。</div> : null}
                  {file.dataUrl ? (
                    <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[var(--bg-hover)] p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={file.dataUrl} alt={file.path} className="max-h-full max-w-full rounded-md object-contain" />
                    </div>
                  ) : fileMode === "preview" && file.language === "markdown" ? (
                    <div className="min-h-0 flex-1 overflow-y-auto p-4">
                      <Markdown content={draft} />
                    </div>
                  ) : (
                    <textarea
                      value={draft}
                      onChange={event => setDraft(event.target.value)}
                      readOnly={file.readOnly}
                      spellCheck={false}
                      wrap="off"
                      aria-label={`编辑 ${file.path}`}
                      className="min-h-0 flex-1 resize-none overflow-auto bg-[var(--bg)] p-3 font-mono text-[11px] leading-[1.65] text-[var(--text)] outline-none"
                    />
                  )}
                  <div className="flex h-6 shrink-0 items-center justify-between border-t border-[var(--border)] px-2 font-mono text-[9px] text-[var(--text-dim)]">
                    <span>{file.language}</span>
                    <span>{formatBytes(file.size)} · {draft.split("\n").length} 行</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center text-[var(--text-dim)]">
                  <Code2 className="h-7 w-7 opacity-50" />
                  <p className="text-[12px]">{fileLoading ? "正在读取文件…" : "从左侧文件树选择文件"}</p>
                  <p className="max-w-56 text-[10px] leading-relaxed">支持源码查看、编辑保存、Markdown 预览和图片查看。</p>
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="flex min-h-0 flex-1 flex-col">
            {/* Terminal tabs preserve cwd and history per tab. */}
            <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border)] px-2">
              {terminals.map(item => (
                <div key={item.id} className={cn("flex shrink-0 items-center rounded-md border text-[10px]", item.id === activeTerminalId ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]" : "border-transparent text-[var(--text-muted)]")}>
                  <button type="button" onClick={() => setActiveTerminalId(item.id)} className="px-2 py-1">{item.title}</button>
                  {terminals.length > 1 ? <button type="button" onClick={() => closeTerminal(item.id)} className="pr-1 text-[var(--text-dim)] hover:text-[var(--text)]"><X className="h-2.5 w-2.5" /></button> : null}
                </div>
              ))}
              <button type="button" onClick={createTerminal} title="新建终端标签" className="ml-auto rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div ref={outputRef} className="min-h-0 flex-1 overflow-y-auto bg-[var(--bg)] p-3 font-mono text-[11px] leading-[1.65]">
              <div className="mb-3 text-[10px] text-[var(--text-dim)]">受控终端 · 单次命令执行 · cwd 与输出按标签保留</div>
              {activeTerminal?.entries.map(entry => (
                <div key={entry.id} className="mb-3">
                  <div className="flex items-start gap-1.5 text-[var(--accent)]">
                    <span className="shrink-0 text-[var(--text-dim)]">{entry.cwd === "." ? "~" : entry.cwd} $</span>
                    <span className="break-all text-[var(--text)]">{entry.command}</span>
                  </div>
                  {entry.pending ? <div className="mt-1 flex items-center gap-1 text-[var(--text-dim)]"><Loader2 className="h-3 w-3 animate-spin" />执行中…</div> : null}
                  {entry.result?.stdout ? <pre className="mt-1 whitespace-pre-wrap break-words text-[var(--text)]">{entry.result.stdout}</pre> : null}
                  {entry.result?.stderr ? <pre className="mt-1 whitespace-pre-wrap break-words text-rose-600 dark:text-rose-300">{entry.result.stderr}</pre> : null}
                  {entry.error ? <pre className="mt-1 whitespace-pre-wrap break-words text-rose-600 dark:text-rose-300">{entry.error}</pre> : null}
                  {entry.result ? <div className="mt-0.5 text-[9px] text-[var(--text-dim)]">exit {entry.result.exitCode} · {entry.result.durationMs}ms{entry.result.approvalRequired ? " · 需要审批" : ""}</div> : null}
                </div>
              ))}
              {!activeTerminal?.entries.length ? <div className="text-[var(--text-dim)]">输入 `pwd`、`ls`、`git status` 开始探索工作区。</div> : null}
            </div>

            <div className="flex shrink-0 items-center gap-1 border-t border-[var(--border)] px-2 py-1.5">
              {["pwd", "ls", "git status"].map(quick => (
                <button key={quick} type="button" onClick={() => void executeCommand(quick)} disabled={Boolean(runningId)} className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] disabled:opacity-40">
                  {quick}
                </button>
              ))}
            </div>
            <form
              onSubmit={event => { event.preventDefault(); void executeCommand(command); }}
              className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] bg-[var(--bg-panel)] px-2.5 py-2"
            >
              <span className="shrink-0 font-mono text-[10px] text-[var(--accent)]">{activeTerminal?.cwd === "." ? "~" : activeTerminal?.cwd} $</span>
              <input
                value={command}
                onChange={event => setCommand(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    const last = activeTerminal?.entries.filter(entry => entry.command).at(-1);
                    if (last) setCommand(last.command);
                  }
                }}
                placeholder={runningId ? "命令执行中…" : "输入命令，Enter 执行"}
                disabled={Boolean(runningId)}
                className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-[var(--text)] outline-none placeholder:text-[var(--text-dim)]"
              />
              <button type="submit" disabled={!command.trim() || Boolean(runningId)} title="执行命令" className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--accent-contrast)] disabled:opacity-30">
                {runningId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3 w-3" />}
              </button>
            </form>
          </section>
        )}
      </aside>
    </>
  );
}

function FileTreeBranch({
  path,
  depth,
  tree,
  expanded,
  loadingDirs,
  selectedPath,
  onToggleDirectory,
  onOpenFile,
}: {
  path: string;
  depth: number;
  tree: Record<string, WorkspaceEntry[]>;
  expanded: Set<string>;
  loadingDirs: Set<string>;
  selectedPath?: string;
  onToggleDirectory: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const entries = tree[path] ?? [];
  return (
    <>
      {entries.map(entry => {
        const isDirectory = entry.type === "directory";
        const isExpanded = expanded.has(entry.path);
        const isLoading = loadingDirs.has(entry.path);
        return (
          <React.Fragment key={entry.path}>
            <button
              type="button"
              onClick={() => isDirectory ? onToggleDirectory(entry.path) : onOpenFile(entry.path)}
              title={entry.path}
              className={cn(
                "flex w-full items-center gap-1 py-1 pr-1 text-left text-[11px] transition-colors",
                selectedPath === entry.path ? "bg-[var(--bg-selected)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]",
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {isDirectory ? (
                isLoading ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
              ) : <span className="w-3 shrink-0" />}
              {isDirectory ? (
                isExpanded ? <FolderOpen className="h-3 w-3 shrink-0 text-[var(--accent)]" /> : <Folder className="h-3 w-3 shrink-0 text-[var(--accent)]" />
              ) : <FileCode2 className="h-3 w-3 shrink-0 text-[var(--text-dim)]" />}
              <span className="min-w-0 truncate">{entry.name}</span>
            </button>
            {isDirectory && isExpanded ? (
              <FileTreeBranch
                path={entry.path}
                depth={depth + 1}
                tree={tree}
                expanded={expanded}
                loadingDirs={loadingDirs}
                selectedPath={selectedPath}
                onToggleDirectory={onToggleDirectory}
                onOpenFile={onOpenFile}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
}
