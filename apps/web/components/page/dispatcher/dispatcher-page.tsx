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
  const { overview, handleCreateJob, apiBaseUrl } = useDashboardSession();
  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState<ScrapeStrategy>("auto");
  const [workerId, setWorkerId] = useState("");
  const [workerServiceName, setWorkerServiceName] = useState("");
  const [workerHostname, setWorkerHostname] = useState("");
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
    targetWorkerServiceName: workerServiceName.trim() || undefined,
    targetWorkerHostname: workerHostname.trim() || undefined,
    options: buildOptions(),
  });

  const applyPayloadFromJson = (payload: unknown): string | undefined => {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return "Payload harus object JSON dengan format { url, strategy, targetWorkerId, targetWorkerServiceName, targetWorkerHostname, options }";
    }

    const root = payload as Record<string, unknown>;

    if (typeof root.url !== "string" || !root.url.trim()) {
      return "Field `url` wajib string dan tidak boleh kosong";
    }

    if (
      root.strategy !== undefined &&
      root.strategy !== "auto" &&
      root.strategy !== "cloudscraper" &&
      root.strategy !== "playwright"
    ) {
      return "Field `strategy` harus salah satu: auto, cloudscraper, playwright";
    }

    if (
      root.targetWorkerId !== undefined &&
      typeof root.targetWorkerId !== "string"
    ) {
      return "Field `targetWorkerId` harus berupa string";
    }

    if (
      root.targetWorkerServiceName !== undefined &&
      typeof root.targetWorkerServiceName !== "string"
    ) {
      return "Field `targetWorkerServiceName` harus berupa string";
    }

    if (
      root.targetWorkerHostname !== undefined &&
      typeof root.targetWorkerHostname !== "string"
    ) {
      return "Field `targetWorkerHostname` harus berupa string";
    }

    const nextOptionsRaw = root.options;
    if (
      nextOptionsRaw !== undefined &&
      (!nextOptionsRaw ||
        typeof nextOptionsRaw !== "object" ||
        Array.isArray(nextOptionsRaw))
    ) {
      return "Field `options` harus berupa object";
    }

    const nextOptions = (nextOptionsRaw ?? {}) as Record<string, unknown>;

    const isStringRecord = (
      value: unknown,
    ): value is Record<string, string> => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
      return Object.values(value as Record<string, unknown>).every(
        (v) => typeof v === "string",
      );
    };

    if (
      nextOptions.headers !== undefined &&
      !isStringRecord(nextOptions.headers)
    ) {
      return "Field `options.headers` harus object dengan value string";
    }
    if (
      nextOptions.formData !== undefined &&
      !isStringRecord(nextOptions.formData)
    ) {
      return "Field `options.formData` harus object dengan value string";
    }

    if (
      nextOptions.useCache !== undefined &&
      typeof nextOptions.useCache !== "boolean"
    ) {
      return "Field `options.useCache` harus boolean";
    }
    if (
      nextOptions.useProxy !== undefined &&
      typeof nextOptions.useProxy !== "boolean"
    ) {
      return "Field `options.useProxy` harus boolean";
    }

    if (nextOptions.waitUntil !== undefined) {
      const waitUntilValue = nextOptions.waitUntil;
      if (
        waitUntilValue !== "load" &&
        waitUntilValue !== "domcontentloaded" &&
        waitUntilValue !== "networkidle" &&
        waitUntilValue !== "commit"
      ) {
        return "Field `options.waitUntil` harus salah satu: load, domcontentloaded, networkidle, commit";
      }
    }

    const toStringNumber = (value: unknown): string | null => {
      if (value === undefined) return null;
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      return String(Math.trunc(value));
    };

    const toRows = (
      record: Record<string, string>,
    ): { id: string; key: string; value: string }[] => {
      return Object.entries(record).map(([key, value], index) => ({
        id: `${Date.now()}-${index}-${key}`,
        key,
        value,
      }));
    };

    setUrl(root.url.trim());
    if (root.strategy) {
      setStrategy(root.strategy as ScrapeStrategy);
    }
    setWorkerId(
      typeof root.targetWorkerId === "string" ? root.targetWorkerId : "",
    );
    setWorkerServiceName(
      typeof root.targetWorkerServiceName === "string"
        ? root.targetWorkerServiceName
        : "",
    );
    setWorkerHostname(
      typeof root.targetWorkerHostname === "string"
        ? root.targetWorkerHostname
        : "",
    );

    const nextTimeout = toStringNumber(nextOptions.timeoutMs);
    const nextMaxRetries = toStringNumber(nextOptions.maxRetries);
    const nextRetryDelay = toStringNumber(nextOptions.retryDelayMs);
    const nextCacheTtl = toStringNumber(nextOptions.cacheTtlSeconds);
    const nextAdditionalDelay = toStringNumber(nextOptions.additionalDelayMs);

    if (nextTimeout !== null) setTimeoutMs(nextTimeout);
    if (nextMaxRetries !== null) setMaxRetries(nextMaxRetries);
    if (nextRetryDelay !== null) setRetryDelayMs(nextRetryDelay);
    if (nextCacheTtl !== null) setCacheTtlSeconds(nextCacheTtl);
    if (nextAdditionalDelay !== null) setAdditionalDelayMs(nextAdditionalDelay);

    if (typeof nextOptions.waitUntil === "string") {
      setWaitUntil(nextOptions.waitUntil as ScrapeWaitUntil);
    }
    if (typeof nextOptions.waitForSelector === "string") {
      setWaitForSelector(nextOptions.waitForSelector);
    }
    if (typeof nextOptions.waitForFunction === "string") {
      setWaitForFunction(nextOptions.waitForFunction);
    }
    if (typeof nextOptions.method === "string") {
      setMethod(nextOptions.method.toUpperCase());
    }
    if (typeof nextOptions.useCache === "boolean") {
      setUseCache(nextOptions.useCache);
    }
    if (typeof nextOptions.useProxy === "boolean") {
      setUseProxy(nextOptions.useProxy);
    }
    if (typeof nextOptions.proxyUrl === "string") {
      setProxyUrl(nextOptions.proxyUrl);
    }

    if (isStringRecord(nextOptions.headers)) {
      setHeaders(toRows(nextOptions.headers));
    }
    if (isStringRecord(nextOptions.formData)) {
      setFormData(toRows(nextOptions.formData));
    }

    return undefined;
  };

  const onSubmit = async () => {
    if (!url.trim()) return;

    setLoading(true);
    try {
      const result = await handleCreateJob(
        url,
        strategy,
        workerId || undefined,
        workerServiceName.trim() || undefined,
        workerHostname.trim() || undefined,
        buildOptions(),
      );
      if (result?.jobId) {
        setLastJobId(result.jobId);
        setLastJobRecord({
          jobId: result.jobId,
          url,
          strategy,
          targetWorkerId: workerId || undefined,
          targetWorkerServiceName: workerServiceName.trim() || undefined,
          targetWorkerHostname: workerHostname.trim() || undefined,
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
        const response = await fetch(`${apiBaseUrl}/jobs/${lastJobId}/result`, {
          credentials: "include",
        });
        if (!response.ok) {
          if (!cancelled) {
            setLastJobResult(null);
          }
          return;
        }

        const raw = await response.text();
        if (!raw.trim()) {
          if (!cancelled) {
            setLastJobResult(null);
          }
          return;
        }

        const data = JSON.parse(raw) as ScrapeJobResult;
        if (!cancelled) {
          setLastJobResult(data);
          setLastJobRecord((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: data.status ?? prev.status,
              progress: data.progress ?? prev.progress,
              stage: data.stage ?? prev.stage,
              strategy: data.strategy ?? prev.strategy,
              updatedAt: new Date().toISOString(),
              error: data.error,
            } as ScrapeJobRecord;
          });
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
  }, [apiBaseUrl, lastJobId]);

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

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Target Worker Service Name
                </label>
                <Input
                  placeholder="crawlix-worker-coolify"
                  value={workerServiceName}
                  onChange={(e) => setWorkerServiceName(e.target.value)}
                  className="bg-[#121828] border-[#1a2235] text-slate-200 h-12 rounded-xl focus-visible:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-600">
                  Optional. Use this when the worker is identified by
                  `WORKER_SERVICE_NAME`; this is the grouping key for
                  round-robin targeting.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Target Worker Hostname
                </label>
                <Input
                  placeholder="crawlix-worker-east-1"
                  value={workerHostname}
                  onChange={(e) => setWorkerHostname(e.target.value)}
                  className="bg-[#121828] border-[#1a2235] text-slate-200 h-12 rounded-xl focus-visible:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-600">
                  Optional. If set together with worker ID, worker ID will be
                  prioritized. Use this for exact host matching, not grouping.
                </p>
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
              <JsonPreview
                data={buildFullPayload()}
                title="Request Payload"
                onManualPayloadChange={applyPayloadFromJson}
              />

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
