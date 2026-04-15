"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckSquare,
  Clock3,
  Rabbit,
  LoaderCircle,
  PanelTop,
  RotateCcw,
  ShieldX,
  ChevronRight,
  Search,
  ArrowLeft,
} from "lucide-react";
import type {
  ScrapeJobRecord,
  ScrapeJobResult,
  WorkerHeartbeat,
} from "@repo/queue-contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDashboardSession } from "@/components/page/dashboard/session-provider";
import { cn } from "@/lib/utils";
import { HtmlViewer } from "./html-viewer";

function formatRelativeTime(val?: string) {
  if (!val) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(val));
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
    queued: "Pending",
    timeout: "Timeout",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
        styles[status],
      )}
    >
      {status === "processing" && (
        <div className="animate-spin size-2 rounded-full border border-b-0 border-current" />
      )}
      {status === "queued" && (
        <div className="size-1.5 rounded-full bg-slate-500" />
      )}
      {labels[status]}
    </span>
  );
}

function stringifyPayload(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isHtmlLike(result: ScrapeJobResult | null): boolean {
  if (!result) return false;
  if ((result.contentType ?? "").toLowerCase().includes("html")) return true;
  const payload = stringifyPayload(result.content ?? result.preview).trim();
  return payload.startsWith("<") || payload.includes("</");
}

export function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { overview, handleRetry, handleCancel, apiBaseUrl } =
    useDashboardSession();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<ScrapeJobResult | null>(
    null,
  );
  const [loadingResult, setLoadingResult] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const jobs = useMemo(() => {
    if (!searchQuery) return overview?.recentJobs ?? [];
    return (overview?.recentJobs ?? []).filter(
      (j) =>
        j.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.jobId.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [overview?.recentJobs, searchQuery]);

  const selectedJob =
    overview?.recentJobs.find((j) => j.jobId === selectedJobId) ?? null;

  useEffect(() => {
    const jobIdFromQuery = searchParams.get("jobId");
    if (!jobIdFromQuery) {
      return;
    }
    if (jobIdFromQuery !== selectedJobId) {
      setSelectedJobId(jobIdFromQuery);
    }
  }, [searchParams, selectedJobId]);

  const workerById = useMemo(() => {
    const map = new Map<string, WorkerHeartbeat>();
    for (const worker of overview?.workers ?? []) {
      map.set(worker.workerId, worker);
    }
    return map;
  }, [overview?.workers]);

  const executedOnLabel = useMemo<React.ReactNode>(() => {
    const renderWorker = (serviceName?: string, workerId?: string) => {
      if (!serviceName && !workerId) {
        return "Pending Dispatch";
      }

      return (
        <div className="leading-tight">
          <div className="truncate">{serviceName ?? "Unknown Service"}</div>
          {workerId && (
            <div className="mt-1 truncate text-[11px] font-medium text-slate-500">
              {workerId}
            </div>
          )}
        </div>
      );
    };

    if (
      selectedResult?.executedServiceName ||
      selectedResult?.executedWorkerId
    ) {
      return renderWorker(
        selectedResult.executedServiceName,
        selectedResult.executedWorkerId,
      );
    }

    const workerId =
      selectedResult?.targetWorkerId ?? selectedJob?.targetWorkerId;
    if (workerId) {
      return renderWorker(workerById.get(workerId)?.serviceName, workerId);
    }

    return "Pending Dispatch";
  }, [selectedJob?.targetWorkerId, selectedResult, workerById]);

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedResult(null);
      return;
    }
    let cancelled = false;
    const loadResult = async () => {
      setLoadingResult(true);
      try {
        const response = await fetch(
          `${apiBaseUrl}/jobs/${selectedJobId}/result`,
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          if (!cancelled) setSelectedResult(null);
          return;
        }

        const raw = await response.text();
        if (!raw.trim()) {
          if (!cancelled) setSelectedResult(null);
          return;
        }

        try {
          const parsed = JSON.parse(raw);
          if (cancelled) return;

          if (parsed && typeof parsed === "object") {
            setSelectedResult(parsed as ScrapeJobResult);
          } else {
            setSelectedResult({
              content: String(parsed),
              preview: String(parsed),
            } as ScrapeJobResult);
          }
        } catch (parseError) {
          console.error("Invalid result JSON:", parseError);
          if (!cancelled) {
            setSelectedResult({
              content: raw,
              preview: raw,
            } as ScrapeJobResult);
          }
        }
      } catch (err) {
        console.error("Fetch result error:", err);
        if (!cancelled) setSelectedResult(null);
      } finally {
        if (!cancelled) setLoadingResult(false);
      }
    };

    void loadResult();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, selectedJobId]);

  const onRetry = async (id: string) => {
    setRetryingJobId(id);
    await handleRetry(id);
    setRetryingJobId(null);
  };
  const onCancel = async (id: string) => {
    setCancellingJobId(id);
    await handleCancel(id);
    setCancellingJobId(null);
  };

  const openJobDetail = (jobId: string) => {
    setSelectedJobId(jobId);
    router.replace(`/jobs?jobId=${jobId}`);
  };

  return (
    <div className="flex min-h-[calc(100dvh-140px)] w-full min-w-0 flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 xl:h-[calc(100vh-140px)] xl:flex-row">
      {/* List Container */}
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-[#1a2235] bg-[#0c1220] transition-all duration-300",
          selectedJobId ? "xl:w-100 hidden xl:flex" : "flex-1",
        )}
      >
        <div className="p-5 border-b border-[#1a2235] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-lg">Job Queue</h3>
            <Badge className="bg-[#1a2235] text-slate-500 border-[#334155] font-mono text-[10px]">
              {jobs.length} Items
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-600" />
            <input
              type="text"
              placeholder="Search by URL or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121828] border border-[#1a2235] rounded-xl pl-10 pr-4 py-2 text-sm text-slate-300 outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-2 space-y-1">
            {jobs.length === 0 && (
              <div className="py-20 text-center text-slate-600">
                <Rabbit className="size-12 mx-auto mb-4 opacity-10" />
                <p className="text-sm">No matching jobs found</p>
              </div>
            )}
            {jobs.map((job) => (
              <button
                key={job.jobId}
                onClick={() => openJobDetail(job.jobId)}
                className={cn(
                  "w-full text-left flex items-center justify-between gap-4 rounded-xl px-4 py-4 transition-all group",
                  selectedJobId === job.jobId
                    ? "bg-indigo-600/10 border border-indigo-500/20 shadow-lg shadow-indigo-500/5"
                    : "hover:bg-[#131b2c] border border-transparent",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm font-bold transition-colors",
                      selectedJobId === job.jobId
                        ? "text-indigo-400"
                        : "text-slate-300 group-hover:text-white",
                    )}
                  >
                    {job.url}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-slate-600 font-mono tracking-tighter">
                      {job.jobId.slice(0, 12)}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                      {job.strategy}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={job.status} />
                  <ChevronRight
                    className={cn(
                      "size-3.5 text-slate-700 group-hover:text-slate-400 transition-all",
                      selectedJobId === job.jobId &&
                        "translate-x-1 text-indigo-400",
                    )}
                  />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Details Container */}
      {selectedJobId ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#1a2235] bg-[#0c1220] shadow-2xl animate-in zoom-in-95 duration-200">
          {/* Mobile Header Back */}
          <div className="xl:hidden p-4 border-b border-[#1a2235]">
            <button
              onClick={() => {
                setSelectedJobId(null);
                router.replace("/jobs");
              }}
              className="flex items-center gap-2 text-indigo-400 font-bold text-sm"
            >
              <ArrowLeft className="size-4" /> Back to Queue
            </button>
          </div>

          {/* Top Toolbar */}
          <div className="p-6 border-b border-[#1a2235] flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-[#0c1220]/50 backdrop-blur-md">
            <div className="min-w-0">
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                <PanelTop className="size-5 text-indigo-500" />
                Job Insight
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {selectedJobId}
              </p>
            </div>
            <div className="flex gap-2">
              {selectedJob?.status === "queued" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedJob && onCancel(selectedJob.jobId)}
                  disabled={cancellingJobId === selectedJobId}
                  className="border-[#334155] bg-transparent hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 text-slate-400 rounded-xl"
                >
                  {cancellingJobId === selectedJobId ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <ShieldX className="size-4 mr-2" />
                  )}
                  Cancel Job
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => selectedJob && onRetry(selectedJob.jobId)}
                disabled={retryingJobId === selectedJobId}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/20"
              >
                {retryingJobId === selectedJobId ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4 mr-2" />
                )}
                Re-run Scraper
              </Button>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="min-w-0 space-y-10 p-5 sm:p-8">
              {/* Metadata Section */}
              <section className="space-y-4">
                <h4 className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-600 flex items-center gap-2">
                  <div className="h-px w-4 bg-slate-800" /> Core Metadata
                </h4>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoBox
                    label="Target Host"
                    value={selectedJob?.url ?? "—"}
                    className="lg:col-span-2"
                  />
                  <InfoBox
                    label="Current Status"
                    value={
                      <StatusBadge status={selectedJob?.status ?? "queued"} />
                    }
                  />
                  <InfoBox
                    label="Engine Strategy"
                    value={selectedJob?.strategy ?? "—"}
                    className="capitalize"
                  />
                  <InfoBox
                    label="Assigned Node"
                    value={selectedJob?.targetWorkerId ?? "Global Cluster"}
                  />
                  <InfoBox label="Executed On" value={executedOnLabel} />
                  <InfoBox
                    label="Last Latency"
                    value={
                      selectedResult?.responseTimeMs
                        ? `${selectedResult.responseTimeMs}ms`
                        : "N/A"
                    }
                  />
                  <InfoBox
                    label="Submission"
                    value={formatRelativeTime(selectedJob?.requestedAt)}
                  />
                  <InfoBox
                    label="Activity Sync"
                    value={formatRelativeTime(selectedJob?.updatedAt)}
                  />
                </div>
              </section>

              {/* Result Payload */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-600 flex items-center gap-2">
                    <div className="h-px w-4 bg-slate-800" /> Dynamic Response
                  </h4>
                  {selectedResult?.contentType && (
                    <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px] uppercase font-bold">
                      {selectedResult.contentType}
                    </Badge>
                  )}
                </div>

                {loadingResult ? (
                  <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-[#1a2235] bg-[#070b14]/50">
                    <LoaderCircle className="size-8 animate-spin text-indigo-600 mb-4" />
                    <p className="text-sm font-medium text-slate-500">
                      Retrieving extraction payload...
                    </p>
                  </div>
                ) : selectedResult ? (
                  <div className="space-y-4">
                    {selectedResult.error && (
                      <div className="p-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400 text-sm leading-relaxed border-l-4 border-l-rose-500">
                        <p className="font-black uppercase text-[10px] mb-2 tracking-widest opacity-60">
                          Engine Exception
                        </p>
                        {selectedResult.error}
                      </div>
                    )}
                    {isHtmlLike(selectedResult) ? (
                      <HtmlViewer
                        content={
                          stringifyPayload(
                            selectedResult.content ?? selectedResult.preview,
                          ) || ""
                        }
                      />
                    ) : (
                      <div className="relative group">
                        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 rounded-lg bg-[#1a2235] hover:bg-indigo-600 text-white shadow-xl transition-colors">
                            <CheckSquare className="size-4" />
                          </button>
                        </div>
                        <pre
                          className="max-h-120 overflow-auto rounded-2xl border border-[#1a2235] bg-[#070b14] p-6 text-xs font-mono leading-relaxed text-slate-400 whitespace-pre-wrap"
                          style={{ overflowWrap: "anywhere" }}
                        >
                          {stringifyPayload(
                            selectedResult.content ?? selectedResult.preview,
                          ) || "Payload buffer is empty."}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-[#1a2235] bg-[#070b14]/50 text-center">
                    <Clock3 className="size-10 text-slate-700 mb-4 stroke-1" />
                    <p className="text-sm font-semibold text-slate-400">
                      Result Unresolved
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1 max-w-60">
                      The job is either in progress or the worker has not yet
                      synchronized the result buffer.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>
        </div>
      ) : (
        <div className="flex-1 hidden xl:flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#1a2235] bg-[#0c1220]/50 text-center p-12">
          <div className="size-20 rounded-full bg-indigo-500/10 flex items-center justify-center mb-6">
            <Rabbit className="size-10 text-indigo-500/40" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            No Selection Active
          </h3>
          <p className="text-sm text-slate-500 max-w-sm">
            Pick a specialized job from the queue list to perform forensic
            analysis on results and cluster metadata.
          </p>
        </div>
      )}
    </div>
  );
}

function InfoBox({
  label,
  value,
  className,
}: {
  label: string;
  value: string | React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-[#1a2235]/60 bg-[#121828]/60 p-4 transition-all hover:border-indigo-500/20",
        className,
      )}
    >
      <p className="text-[9px] uppercase font-black tracking-[0.15em] text-slate-600 mb-2">
        {label}
      </p>
      <div className="min-w-0 text-sm font-bold text-slate-200">{value}</div>
    </div>
  );
}
