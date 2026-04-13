"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ChevronDown,
  LoaderCircle,
  Rabbit,
  SlidersHorizontal,
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
} from "@repo/queue-contracts";
import { cn } from "@/lib/utils";

export function DispatcherPage() {
  const { overview, handleCreateJob } = useDashboardSession();
  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState<ScrapeStrategy>("auto");
  const [workerId, setWorkerId] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("30000");
  const [maxRetries, setMaxRetries] = useState("2");
  const [additionalDelayMs, setAdditionalDelayMs] = useState("");
  const [waitUntil, setWaitUntil] = useState<ScrapeWaitUntil>("networkidle");
  const [waitForSelector, setWaitForSelector] = useState("");
  const [method, setMethod] = useState("GET");
  const [useCache, setUseCache] = useState(true);
  const [useProxy, setUseProxy] = useState(false);
  const [proxyUrl, setProxyUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const workers = overview?.workers ?? [];

  const parseOptionalInt = (value: string) => {
    if (!value.trim()) return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? Math.trunc(num) : undefined;
  };

  const buildOptions = (): ScrapeJobOptions => {
    const options: ScrapeJobOptions = {
      timeoutMs: parseOptionalInt(timeoutMs),
      maxRetries: parseOptionalInt(maxRetries),
      additionalDelayMs: parseOptionalInt(additionalDelayMs),
      waitUntil,
      waitForSelector: waitForSelector.trim() || undefined,
      method: method.trim() || undefined,
      useCache,
      useProxy,
      proxyUrl: proxyUrl.trim() || undefined,
    };

    return Object.fromEntries(
      Object.entries(options).filter(([, value]) => value !== undefined),
    ) as ScrapeJobOptions;
  };

  const onSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    await handleCreateJob(
      url.trim(),
      strategy,
      workerId || undefined,
      buildOptions(),
    );
    setUrl("");
    setLoading(false);
  };

  return (
    <div className="w-full min-w-0 max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

              <details className="group rounded-2xl border border-[#1a2235] bg-[#070b14]/60">
                <summary className="flex list-none cursor-pointer items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="size-4 text-indigo-400" />
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                      Advanced Configuration
                    </span>
                  </div>
                  <ChevronDown className="size-4 text-slate-500 transition-transform group-open:rotate-180" />
                </summary>

                <div className="space-y-4 border-t border-[#1a2235] px-4 pb-4 pt-1">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FieldLabel label="Method">
                      <Select
                        value={method}
                        onValueChange={(value) => setMethod(value ?? "GET")}
                      >
                        <SelectTrigger className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#121828] border-[#1a2235] text-slate-200">
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldLabel>

                    <FieldLabel label="Wait Until">
                      <Select
                        value={waitUntil}
                        onValueChange={(value) =>
                          setWaitUntil(value as ScrapeWaitUntil)
                        }
                      >
                        <SelectTrigger className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#121828] border-[#1a2235] text-slate-200">
                          <SelectItem value="load">load</SelectItem>
                          <SelectItem value="domcontentloaded">
                            domcontentloaded
                          </SelectItem>
                          <SelectItem value="networkidle">
                            networkidle
                          </SelectItem>
                          <SelectItem value="commit">commit</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldLabel>

                    <FieldLabel label="Timeout (ms)">
                      <Input
                        value={timeoutMs}
                        onChange={(e) => setTimeoutMs(e.target.value)}
                        type="number"
                        min={1}
                        placeholder="30000"
                        className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl"
                      />
                    </FieldLabel>

                    <FieldLabel label="Max Retries">
                      <Input
                        value={maxRetries}
                        onChange={(e) => setMaxRetries(e.target.value)}
                        type="number"
                        min={0}
                        placeholder="2"
                        className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl"
                      />
                    </FieldLabel>

                    <FieldLabel label="Additional Delay (ms)">
                      <Input
                        value={additionalDelayMs}
                        onChange={(e) => setAdditionalDelayMs(e.target.value)}
                        type="number"
                        min={0}
                        placeholder="optional"
                        className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl"
                      />
                    </FieldLabel>

                    <FieldLabel label="Wait For Selector">
                      <Input
                        value={waitForSelector}
                        onChange={(e) => setWaitForSelector(e.target.value)}
                        placeholder="e.g. #main-content"
                        className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl"
                      />
                    </FieldLabel>

                    <FieldLabel label="Proxy URL (Optional)">
                      <Input
                        value={proxyUrl}
                        onChange={(e) => setProxyUrl(e.target.value)}
                        placeholder="http://ip:port"
                        disabled={!useProxy}
                        className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl disabled:opacity-50"
                      />
                    </FieldLabel>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleRow
                      label="Use Cache"
                      value={useCache}
                      onChange={setUseCache}
                    />
                    <ToggleRow
                      label="Use Proxy"
                      value={useProxy}
                      onChange={setUseProxy}
                    />
                  </div>
                </div>
              </details>

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
                desc: "Full DOM execution",
              },
            ].map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="p-4 rounded-2xl border border-[#1a2235] bg-[#0c1220]/50 hover:bg-[#0c1220] transition-colors"
              >
                <Icon className="size-5 text-indigo-400 mb-2" />
                <h4 className="text-xs font-bold text-white mb-1 uppercase tracking-wider">
                  {label}
                </h4>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Status / Sidebar */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div className="space-y-6 rounded-3xl border border-[#1a2235] bg-[#0c1220] p-5 shadow-xl sm:p-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Queue Health Check
            </h3>
            <div className="space-y-4">
              <StatusRow
                label="Connected Nodes"
                value={String(workers.length)}
              />
              <StatusRow label="Current Latency" value="Stable (14ms)" />
              <StatusRow label="Cluster Uptime" value="99.98%" />
              <StatusRow
                label="Active Workers"
                value={String(
                  workers.filter((w) => w.status === "processing").length,
                )}
                highlight
              />
            </div>
            <div className="pt-4 border-t border-[#1a2235]">
              <p className="text-[10px] text-slate-600 leading-relaxed font-mono italic">
                The dispatcher sends a high-priority message to the AMQP
                exchange. Targeted workers will acknowledge and perform a
                synchronous crawl-and-store operation.
              </p>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-3xl bg-indigo-600 p-6 text-white shadow-2xl shadow-indigo-600/20 sm:p-8">
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-125 transition-transform duration-700">
              <Rabbit className="size-32" />
            </div>
            <h4 className="text-xl font-black mb-2 uppercase tracking-tighter">
              Enterprise Mode
            </h4>
            <p className="text-xs text-indigo-100/80 leading-relaxed">
              Automate your data pipeline with our programmatic API. Visit the
              Keys section to generate your token.
            </p>
            <Link
              href="/keys"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-600"
            >
              Manage Access <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span
        className={cn(
          "text-xs font-bold tracking-tight",
          highlight ? "text-indigo-400" : "text-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2 block">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full rounded-xl border border-[#1a2235] bg-[#121828] px-3 py-2 flex items-center justify-between text-left"
    >
      <span className="text-[11px] font-semibold text-slate-300">{label}</span>
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
          value
            ? "bg-indigo-500/20 text-indigo-300"
            : "bg-slate-700/50 text-slate-400",
        )}
      >
        {value ? "On" : "Off"}
      </span>
    </button>
  );
}
