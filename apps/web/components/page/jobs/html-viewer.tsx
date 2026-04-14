"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HtmlViewerProps {
  content: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function syntaxHighlightHtml(escaped: string): string {
  let output = escaped;

  output = output.replace(
    /&lt;(\/?)([a-zA-Z0-9:-]+)/g,
    '&lt;<span class="text-rose-300">$1$2</span>',
  );

  output = output.replace(
    /([:@a-zA-Z0-9_-]+)=(&quot;.*?&quot;|&#39;.*?&#39;)/g,
    '<span class="text-sky-300">$1</span>=<span class="text-emerald-300">$2</span>',
  );

  output = output.replace(
    /(&lt;!--[\s\S]*?--&gt;)/g,
    '<span class="text-slate-500">$1</span>',
  );

  return output;
}

export function HtmlViewer({ content }: HtmlViewerProps) {
  const [search, setSearch] = useState("");

  const prepared = useMemo(() => {
    const escaped = escapeHtml(content || "");
    const highlighted = syntaxHighlightHtml(escaped);

    if (!search.trim()) {
      return { html: highlighted, matches: 0 };
    }

    const pattern = new RegExp(escapeRegExp(search), "gi");
    const matches = (content.match(pattern) ?? []).length;

    const htmlWithMatches = highlighted.replace(pattern, (m) => {
      return `<mark class="bg-amber-300/30 text-amber-200 px-0.5 rounded">${m}</mark>`;
    });

    return { html: htmlWithMatches, matches };
  }, [content, search]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search HTML response"
            className="pl-9 bg-[#121828] border-[#1a2235] text-slate-200 h-10 rounded-xl"
          />
        </div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
          {prepared.matches} match
          {prepared.matches === 1 ? "" : "es"}
        </div>
      </div>

      <div className="max-h-120 overflow-auto rounded-2xl border border-[#1a2235] bg-[#070b14] p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-300">
        <pre
          className="m-0"
          dangerouslySetInnerHTML={{
            __html:
              prepared.html ||
              '<span class="text-slate-600">Empty HTML payload.</span>',
          }}
        />
      </div>
    </div>
  );
}
