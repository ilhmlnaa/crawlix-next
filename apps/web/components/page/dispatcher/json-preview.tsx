"use client";

import { Check, ChevronDown, Copy, PencilLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileBraces } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface JsonPreviewProps {
  data: object;
  title?: string;
  onManualPayloadChange?: (payload: unknown) => string | undefined;
}

export function JsonPreview({
  data,
  title = "Request Payload",
  onManualPayloadChange,
}: JsonPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editorValue, setEditorValue] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);

  const jsonString = useMemo(() => JSON.stringify(data, null, 2), [data]);

  useEffect(() => {
    if (!isEditing) {
      setEditorValue(jsonString);
      setEditorError(null);
    }
  }, [jsonString, isEditing]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleEditorChange = (nextValue: string) => {
    setEditorValue(nextValue);

    try {
      const parsed = JSON.parse(nextValue);
      const validationError = onManualPayloadChange?.(parsed);
      if (validationError) {
        setEditorError(validationError);
        return;
      }
      setEditorError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid JSON format";
      setEditorError(message);
    }
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
              setIsEditing((prev) => !prev);
              setEditorError(null);
              if (!isEditing) {
                setEditorValue(jsonString);
              }
            }}
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-[#1a2235] bg-transparent text-slate-400 hover:border-indigo-500/20 hover:bg-indigo-500/10 hover:text-indigo-400"
          >
            <PencilLine className="size-3.5 mr-1.5" />
            {isEditing ? "Preview" : "Manual Edit"}
          </Button>
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
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editorValue}
              onChange={(e) => handleEditorChange(e.target.value)}
              spellCheck={false}
              className="min-h-72 w-full resize-y rounded-xl border border-[#1a2235] bg-[#070b14] p-4 font-mono text-xs leading-relaxed text-slate-200 outline-none transition-colors focus:border-indigo-500/30"
            />
            {editorError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                JSON Error: {editorError}
              </div>
            )}
          </div>
        ) : (
          <div className="max-h-96 overflow-auto rounded-xl border border-[#1a2235] bg-[#070b14] p-2">
            <SyntaxHighlighter
              language="json"
              style={oneDark}
              customStyle={{
                margin: 0,
                background: "transparent",
                fontSize: "12px",
                lineHeight: "1.45",
              }}
              wrapLongLines
            >
              {jsonString}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </details>
  );
}
