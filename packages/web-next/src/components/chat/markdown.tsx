"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/ui/copy-button";
import { splitMarkdownBlocks } from "@/lib/markdown-blocks";
import { cn } from "@/lib/utils";

const REMARK_PLUGINS = [remarkGfm];

function safeUrl(url: string): string {
  // Keep local file/document links and data images, reject javascript: and
  // other executable protocols before they reach the DOM.
  if (/^(https?:|mailto:|#|\/|\.{1,2}\/|data:image\/)/i.test(url)) return url;
  return "";
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="group/code my-3 overflow-hidden rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)]">
      <div className="flex h-7 items-center gap-2 border-b border-[var(--code-border)] bg-[var(--code-header-bg)] px-3">
        <span className="font-mono text-[10px] text-[var(--code-muted)]">{language || "text"}</span>
        <span className="ml-auto">
          <CopyButton
            value={code}
            label="复制代码"
            className="text-[var(--code-muted)] hover:bg-white/10 hover:text-[var(--code-text)]"
          />
        </span>
      </div>
      <pre className="max-h-[420px] overflow-auto p-3.5 font-mono text-[11.5px] leading-[1.65] text-[var(--code-text)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const MarkdownBlock = React.memo(function MarkdownBlock({
  markdown,
  components,
}: {
  markdown: string;
  components: Components;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      urlTransform={safeUrl}
      components={components}
    >
      {markdown}
    </ReactMarkdown>
  );
});

export function Markdown({
  content,
  className,
  isStreaming = false,
}: {
  content: string;
  className?: string;
  isStreaming?: boolean;
}) {
  const normalized = React.useMemo(() => content.replace(/\r\n?/g, "\n"), [content]);
  const blocks = React.useMemo(
    () => (isStreaming ? splitMarkdownBlocks(normalized) : [normalized]),
    [isStreaming, normalized],
  );

  const components = React.useMemo<Components>(() => ({
    code({ node: _node, className, children, ...props }) {
      const language = className?.replace("language-", "").toLowerCase() || "";
      const raw = String(children);
      const isBlock = Boolean(className?.includes("language-")) || raw.includes("\n");
      if (isBlock) return <CodeBlock code={raw.replace(/\n$/, "")} language={language} />;
      return (
        <code className="md-inline-code" {...props}>
          {children}
        </code>
      );
    },
    // CodeBlock owns its own pre. Returning children here avoids invalid
    // <pre><div> nesting and preserves Pi Web's block structure.
    pre({ children }) {
      return <>{children}</>;
    },
    a({ node: _node, href, children, ...props }) {
      const external = Boolean(href && /^https?:\/\//i.test(href));
      return (
        <a
          href={href}
          {...props}
          target={external ? "_blank" : undefined}
          rel={external ? "noreferrer noopener" : undefined}
        >
          {children}
        </a>
      );
    },
    img({ node: _node, src, alt, ...props }) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt={alt ?? ""} loading="lazy" {...props} />;
    },
    input({ node: _node, ...props }) {
      return <input {...props} disabled />;
    },
  }), []);

  return (
    <div className={cn("md-body", className)}>
      {blocks.map((block, index) => (
        <MarkdownBlock key={index} markdown={block} components={components} />
      ))}
    </div>
  );
}
