"use client";

import Link from "next/link";
import { Clock3, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { ScrapeJobRecord, ScrapeJobResult } from "@repo/queue-contracts";
import { cn } from "@/lib/utils";

interface ResultDisplayProps {
  job: ScrapeJobRecord | null;
  result: ScrapeJobResult | null;
  loading: boolean;
  error?: string;
}

function StatusBadge({ status }: { status: ScrapeJobRecord["status"] }) {
  const styles: Record<ScrapeJobRecord["status"], string> = {
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    processing: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    failed: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    cancelled: "bg-[#1e293b] text-slate-400 border-[#334155]",
    queued: "bg-[#1e293b] text-slate-400 border-[#334155]",
    timeout: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  const labels: Record<ScrapeJobRecord["status"], string> = {
    completed: "Completed",
    processing: "Processing",
    failed: "Failed",
    cancelled: "Cancelled",
    queued: "Queued",
    timeout: "Timeout",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
        styles[status],
      )}
    >
      {status === "processing" && <Loader2 className="size-2.5 animate-spin" />}
      {labels[status]}
    </span>
  );
}

export function ResultDisplay({
  job,
  result,
  loading,
  error,
}: ResultDisplayProps) {
  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-[#1a2235] bg-[#070b14]/50 text-center">
        <Clock3 className="size-10 text-slate-700 mb-4 stroke-1" />
        <p className="text-sm font-semibold text-slate-400">
          Awaiting Dispatch
        </p>
        <p className="text-[11px] text-slate-600 mt-1 max-w-60">
          Execute a job above to view real-time results and metadata here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5 sm:p-8 bg-[#0c1220] rounded-2xl border border-[#1a2235]">
      {/* Job Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white mb-2">Dispatch Result</h3>
          <p className="text-xs text-slate-500 font-mono">{job.jobId}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={job.status} />
          <Link
            href={`/jobs?jobId=${job.jobId}`}
            rel="noreferrer"
            className="inline-flex items-center rounded-lg border border-[#334155] bg-transparent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300 hover:border-indigo-500/40 hover:text-indigo-300"
          >
            Open Detail
          </Link>
        </div>
      </div>

      {/* Progress Bar */}
      {job.status === "processing" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-600">
              Execution Progress
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {job.progress}%
            </span>
          </div>
          <Progress value={job.progress} className="h-2" />
          <p className="text-[9px] text-slate-600 capitalize">
            Stage: {job.stage}
          </p>
        </div>
      )}

      {/* Metadata Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MetadataBox
          label="Strategy"
          value={job.strategy}
          className="capitalize"
        />
        <MetadataBox
          label="Response Time"
          value={result?.responseTimeMs ? `${result.responseTimeMs}ms` : "—"}
        />
        <MetadataBox label="Content Type" value={result?.contentType || "—"} />
        <MetadataBox
          label="Requests Retried"
          value={result?.retries?.toString() || "0"}
        />
      </div>

      {/* Error Display */}
      {(error || job.error || result?.error) && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400 space-y-2">
          <div className="flex items-gap gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold">Execution Error</p>
              <p className="text-sm mt-1 text-rose-300">
                {error || job.error || result?.error || "Unknown error"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {result && !result.error && job.status === "completed" && (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center gap-2">
          <CheckCircle className="size-4 shrink-0" />
          <span className="text-sm font-bold">
            Request completed successfully
          </span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-indigo-500" />
            <p className="text-sm text-slate-500">Retrieving job result...</p>
          </div>
        </div>
      )}

      {/* Content Preview */}
      {result?.content && !loading && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-600">
            Response Preview
          </p>
          <div className="max-h-48 overflow-auto rounded-lg border border-[#1a2235] bg-[#070b14] p-4">
            <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
              {typeof result.content === "string"
                ? result.content.substring(0, 500)
                : JSON.stringify(result.content, null, 2).substring(0, 500)}
              {result.content && result.content.toString().length > 500 && (
                <>{"\n"}... (truncated)</>
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function MetadataBox({
  label,
  value,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-[#1a2235]/60 bg-[#121828]/60 p-3">
      <p className="text-[9px] uppercase font-bold tracking-[0.15em] text-slate-600 mb-1">
        {label}
      </p>
      <div className={cn("text-sm font-bold text-slate-200", className)}>
        {value}
      </div>
    </div>
  );
}
