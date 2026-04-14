"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  LoaderCircle,
  Terminal,
  Globe,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardSession } from "@/components/page/dashboard/session-provider";
import type {
  ScrapeJobOptions,
  ScrapeStrategy,
  ScrapeWaitUntil,
  ScrapeJobRecord,
  ScrapeJobResult,
} from "@repo/queue-contracts";
import { AdvancedOptions } from "./advanced-options";
import { FormDataTable, type FormDataEntry } from "./form-data-table";
import { HeadersTable, type HeaderEntry } from "./headers-table";
import { JsonPreview } from "./json-preview";
import { ResultDisplay } from "./result-display";

export function DispatcherPage() {
  const { overview, handleCreateJob } = useDashboardSession();
  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState<ScrapeStrategy>("auto");
  const [workerId, setWorkerId] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("30000");
  const [maxRetries, setMaxRetries] = useState("2");
  const [retryDelayMs, setRetryDelayMs] = useState("1000");
  const [cacheTtlSeconds, setCacheTtlSeconds] = useState("900");
  const [additionalDelayMs, setAdditionalDelayMs] = useState("");
  const [waitUntil, setWaitUntil] =
    useState<ScrapeWaitUntil>("domcontentloaded");
  const [waitForSelector, setWaitForSelector] = useState("");
  const [waitForFunction, setWaitForFunction] = useState("");
  const [method, setMethod] = useState("GET");
  const [useCache, setUseCache] = useState(true);
  const [useProxy, setUseProxy] = useState(false);
  const [proxyUrl, setProxyUrl] = useState("");
  const [headers, setHeaders] = useState<HeaderEntry[]>([]);
  const [formData, setFormData] = useState<FormDataEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [lastJobResult, setLastJobResult] = useState<ScrapeJobResult | null>(
    null,
  );
  const [loadingResult, setLoadingResult] = useState(false);
  const [lastJobRecord, setLastJobRecord] = useState<ScrapeJobRecord | null>(
    null,
  );

  const workers = overview?.workers ?? [];

  const parseOptionalInt = (value: string): number | undefined => {
    const num = parseInt(value, 10);
    return Number.isFinite(num) ? Math.trunc(num) : undefined;
  };

  const buildOptions = (): ScrapeJobOptions => {
    const headersObj = Object.fromEntries(
      headers.filter((h) => h.key.trim()).map((h) => [h.key, h.value]),
    );

    const formDataObj = Object.fromEntries(
      formData.filter((f) => f.key.trim()).map((f) => [f.key, f.value]),
    );

    const options: ScrapeJobOptions = {
      timeoutMs: parseOptionalInt(timeoutMs),
      maxRetries: parseOptionalInt(maxRetries),
      retryDelayMs: parseOptionalInt(retryDelayMs),
      cacheTtlSeconds: parseOptionalInt(cacheTtlSeconds),
      additionalDelayMs: parseOptionalInt(additionalDelayMs),
      waitUntil,
      waitForSelector: waitForSelector.trim() || undefined,
      waitForFunction: waitForFunction.trim() || undefined,
      method: method.trim() || undefined,
      headers: Object.keys(headersObj).length > 0 ? headersObj : undefined,
      formData: Object.keys(formDataObj).length > 0 ? formDataObj : undefined,
      useCache,
      useProxy,
      proxyUrl: proxyUrl.trim() || undefined,
    };

    return Object.fromEntries(
      Object.entries(options).filter(([, value]) => value !== undefined),
    ) as ScrapeJobOptions;
  };

  const buildFullPayload = () => ({
    url,
    strategy,
    targetWorkerId: workerId || undefined,
    options: buildOptions(),
  });

  const onSubmit = async () => {
    if (!url.trim()) return;

    setLoading(true);
    try {
      const result = await handleCreateJob(
        url,
        strategy,
        workerId || undefined,
        buildOptions(),
      );
      if (result?.jobId) {
        setLastJobId(result.jobId);
        setLastJobRecord({
          jobId: result.jobId,
          url,
          strategy,
          targetWorkerId: workerId || undefined,
          status: "queued",
          requestedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as ScrapeJobRecord);
      }
    } finally {
      setLoading(false);
    }
  };

  // Poll for job result
  useEffect(() => {
    if (!lastJobId) {
      setLastJobResult(null);
      return;
    }

    setLoadingResult(true);
    let cancelled = false;

    const loadResult = async () => {
      try {
        const response = await fetch(`/api/jobs/${lastJobId}/result`);
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) {
            setLastJobResult(data);
          }
        }
      } catch (err) {
        console.error("Failed to load result:", err);
      } finally {
        if (!cancelled) setLoadingResult(false);
      }
    };

    void loadResult();
    const pollInterval = setInterval(() => {
      void loadResult();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [lastJobId]);

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Page Header */}
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-2xl font-black text-white tracking-tight uppercase italic">
          Command <span className="text-indigo-500">Dispatcher</span>
        </h1>
        <p className="text-slate-500 text-sm">
          Execute manual crawl instructions against the distributed cluster
          engine.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Main Dispatcher Control */}
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <div className="relative overflow-hidden rounded-3xl border border-[#1a2235] bg-[#0c1220] p-5 shadow-2xl sm:p-6 lg:p-8">
            <div className="absolute right-0 top-0 p-8 opacity-5">
              <Terminal className="size-32" />
            </div>

            <div className="relative z-10 space-y-6">
              {/* URL Input */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                  Target Resource Locator (URL)
                </label>
                <Input
                  placeholder="https://example.com/data-stream"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="bg-[#121828] border-[#1a2235] text-slate-200 h-14 rounded-2xl focus-visible:ring-indigo-500 text-base shadow-inner"
                />
              </div>

              {/* Strategy & Worker Selection */}
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Bypass Strategy
                  </label>
                  <Select
                    value={strategy}
                    onValueChange={(v) => setStrategy(v as ScrapeStrategy)}
                  >
                    <SelectTrigger className="bg-[#121828] border-[#1a2235] text-slate-200 h-12 rounded-xl focus:ring-indigo-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121828] border-[#1a2235] text-slate-200">
                      <SelectItem value="auto">Adaptive Fallback</SelectItem>
                      <SelectItem value="cloudscraper">
                        Cloudscraper Engine
                      </SelectItem>
                      <SelectItem value="playwright">
                        Headless Playwright
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Node Affinity
                  </label>
                  <Select
                    value={workerId || "auto"}
                    onValueChange={(v) =>
                      setWorkerId(v && v !== "auto" ? v : "")
                    }
                  >
                    <SelectTrigger className="bg-[#121828] border-[#1a2235] text-slate-200 h-12 rounded-xl focus:ring-indigo-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121828] border-[#1a2235] text-slate-200">
                      <SelectItem value="auto">Cluster Balanced</SelectItem>
                      {workers.map((w) => (
                        <SelectItem key={w.workerId} value={w.workerId}>
                          {w.hostname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Headers Editor */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  HTTP Headers
                </label>
                <HeadersTable data={headers} onChange={setHeaders} />
              </div>

              {/* Form Data Editor (visible for non-GET methods) */}
              {method.toUpperCase() !== "GET" && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    Form Data Parameters
                  </label>
                  <FormDataTable data={formData} onChange={setFormData} />
                </div>
              )}

              {/* Advanced Options */}
              <AdvancedOptions
                method={method}
                onMethodChange={setMethod}
                waitUntil={waitUntil}
                onWaitUntilChange={setWaitUntil}
                timeoutMs={timeoutMs}
                onTimeoutMsChange={setTimeoutMs}
                maxRetries={maxRetries}
                onMaxRetriesChange={setMaxRetries}
                retryDelayMs={retryDelayMs}
                onRetryDelayMsChange={setRetryDelayMs}
                cacheTtlSeconds={cacheTtlSeconds}
                onCacheTtlSecondsChange={setCacheTtlSeconds}
                additionalDelayMs={additionalDelayMs}
                onAdditionalDelayMsChange={setAdditionalDelayMs}
                waitForSelector={waitForSelector}
                onWaitForSelectorChange={setWaitForSelector}
                waitForFunction={waitForFunction}
                onWaitForFunctionChange={setWaitForFunction}
                proxyUrl={proxyUrl}
                onProxyUrlChange={setProxyUrl}
                useCache={useCache}
                onUseCacheChange={setUseCache}
                useProxy={useProxy}
                onUseProxyChange={setUseProxy}
              />

              {/* JSON Preview */}
              <JsonPreview data={buildFullPayload()} title="Request Payload" />

              {/* Submit Button */}
              <Button
                onClick={onSubmit}
                disabled={loading || !url.trim()}
                className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-600/30 transition-all active:scale-95"
              >
                {loading ? (
                  <LoaderCircle className="size-5 animate-spin mr-2" />
                ) : (
                  <Zap className="size-5 mr-2" />
                )}
                Execute Dispatch
              </Button>
            </div>
          </div>

          {/* Strategy Comparison */}
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: Globe,
                label: "Adaptive",
                desc: "AI-driven fallback logic",
              },
              {
                icon: ShieldCheck,
                label: "Cloudscraper",
                desc: "Bypass L7 protection",
              },
              {
                icon: Activity,
                label: "Playwright",
                desc: "Headless browser engine",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="p-4 rounded-xl border border-[#1a2235] bg-[#070b14]/50 hover:border-indigo-500/20 transition-colors"
              >
                <item.icon className="size-5 text-indigo-400 mb-3" />
                <h4 className="font-bold text-white text-sm mb-1">
                  {item.label}
                </h4>
                <p className="text-[12px] text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Result Display Sidebar */}
        <div className="min-w-0 lg:col-span-2">
          <ResultDisplay
            job={lastJobRecord}
            result={lastJobResult}
            loading={loadingResult}
          />
        </div>
      </div>
    </div>
  );
}
