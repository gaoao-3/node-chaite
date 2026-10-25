"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/ui/copy-button";

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="group/code my-3 overflow-hidden rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)]">
      <div className="flex h-7 items-center gap-2 border-b border-[var(--code-border)] bg-[var(--code-header-bg)] px-3">
        <span className="font-mono text-[10px] text-[var(--code-muted)]">
          {language || "text"}
        </span>
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

const components: Components = {
  pre({ children }) {
    const child = React.Children.toArray(children)[0];
    if (React.isValidElement(child)) {
      const props = child.props as { className?: string; children?: React.ReactNode };
      const match = /language-([\w-]+)/.exec(props.className ?? "");
      const code = String(props.children ?? "").replace(/\n$/, "");
      return <CodeBlock code={code} language={match?.[1]} />;
    }
    return <pre>{children}</pre>;
  },
  code({ className, children }) {
    return <code className={className}>{children}</code>;
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto rounded-xl border border-[var(--border)]">
        <table>{children}</table>
      </div>
    );
  },
  a({ children, href }) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  },
  input({ checked }) {
    return <input type="checkbox" checked={checked} readOnly className="mr-1.5 accent-violet-400" />;
  },
  img({ src, alt }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" />;
  },
};

export const Markdown = React.memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
