"use client";

import { ChevronDown, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileBraces } from "lucide-react";

interface JsonPreviewProps {
  data: object;
  title?: string;
}

export function JsonPreview({
  data,
  title = "Request Payload",
}: JsonPreviewProps) {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <details className="group rounded-2xl border border-[#1a2235] bg-[#070b14]/60">
      <summary className="flex list-none cursor-pointer items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileBraces className="size-4 text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 truncate">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              copyToClipboard();
            }}
            variant="outline"
            size="sm"
            className="h-5 rounded-lg border-[#1a2235] bg-transparent text-slate-400 hover:border-indigo-500/20 hover:bg-indigo-500/10 hover:text-indigo-400"
          >
            {copied ? (
              <>
                <Check className="size-3.5 mr-1.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5 mr-1.5" /> Copy JSON
              </>
            )}
          </Button>
          <ChevronDown className="size-4 text-slate-500 transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-[#1a2235] p-4">
        <div className="max-h-96 overflow-auto rounded-xl border border-[#1a2235] bg-[#070b14] p-4">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
            <code>{jsonString}</code>
          </pre>
        </div>
      </div>
    </details>
  );
}
