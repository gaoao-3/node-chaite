"use client";

import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/ui/copy-button";

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="group/code my-3 overflow-hidden rounded-xl border border-white/[0.075] bg-[#08080d] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex h-8 items-center gap-2 border-b border-white/[0.055] bg-white/[0.025] px-3">
        <span className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400/50" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300/50" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/50" />
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-mist-600">
          {language || "text"}
        </span>
        <span className="ml-auto">
          <CopyButton value={code} label="复制代码" />
        </span>
      </div>
      <pre className="max-h-[420px] overflow-auto p-3.5 font-mono text-[11.5px] leading-[1.7] text-mist-300">
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
      <div className="my-3 overflow-x-auto rounded-xl border border-white/[0.07]">
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
