"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Crosshair,
  KeyRound,
  Rabbit,
  RefreshCw,
  ServerCog,
  Zap,
  Cpu,
  Globe,
  Database,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { useDashboardSession } from "@/components/page/dashboard/session-provider";
import type { JobsOverviewTimeSeriesBucket } from "@repo/queue-contracts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    href: "/dispatcher",
    icon: Crosshair,
    label: "Dispatch New Job",
    description: "Send a URL to the crawl cluster instantly",
    color:
      "from-indigo-500/20 to-indigo-600/10 border-indigo-500/20 text-indigo-400",
    iconBg: "bg-indigo-500/10",
  },
  {
    href: "/jobs",
    icon: Rabbit,
    label: "View Queue Items",
    description: "Monitor all jobs and their payload results",
    color:
      "from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400",
    iconBg: "bg-emerald-500/10",
  },
  {
    href: "/workers",
    icon: ServerCog,
    label: "Fleet Monitoring",
    description: "Live heartbeat view of all connected workers",
    color:
      "from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-400",
    iconBg: "bg-amber-500/10",
  },
  {
    href: "/keys",
    icon: KeyRound,
    label: "Manage API Keys",
    description: "Create, revoke and manage your access tokens",
    color: "from-rose-500/20 to-rose-600/10 border-rose-500/20 text-rose-400",
    iconBg: "bg-rose-500/10",
  },
];

type QueueChartTimeframe = "hour" | "12h" | "day";

const QUEUE_CHART_TIMEFRAMES: Array<{
  value: QueueChartTimeframe;
  label: string;
}> = [
  { value: "hour", label: "Hourly" },
  { value: "12h", label: "Every 12 Hours" },
  { value: "day", label: "Daily" },
];

export function OverviewPage() {
  const {
    overview,
    refreshing,
    handleRefresh,
    overviewTimeSeries,
    queueChartTimeframe,
    setQueueChartTimeframe,
    loadOverviewTimeSeries,
  } = useDashboardSession();

  const totalJobs = overview?.total ?? 0;
  const completed = overview?.statusCounts?.completed ?? 0;
  const failed = overview?.statusCounts?.failed ?? 0;
  const queueDepth = overview?.queueDepth ?? 0;
  const consumerCount = overview?.consumerCount ?? 0;
  const activeWorkers = (overview?.workers ?? []).filter(
    (w) => w.status === "processing",
  ).length;
  const totalWorkers = overview?.workers?.length ?? 0;

  const chartData = useMemo(() => {
    if (!overviewTimeSeries) {
      return [];
    }

    const formatAxisLabel = (date: Date, timeframe: QueueChartTimeframe) => {
      const axisFormat =
        timeframe === "hour"
          ? { hour: "numeric" as const, minute: "2-digit" as const }
          : timeframe === "12h"
            ? { hour: "numeric" as const }
            : { month: "short" as const, day: "numeric" as const };
      return date.toLocaleString("en-US", axisFormat);
    };

    const formatTooltipLabel = (date: Date, timeframe: QueueChartTimeframe) => {
      const fullFormat =
        timeframe === "hour"
          ? {
              weekday: "short" as const,
              month: "short" as const,
              day: "numeric" as const,
              year: "numeric" as const,
              hour: "numeric" as const,
              minute: "2-digit" as const,
            }
          : timeframe === "12h"
            ? {
                weekday: "short" as const,
                month: "short" as const,
                day: "numeric" as const,
                year: "numeric" as const,
                hour: "numeric" as const,
                minute: "2-digit" as const,
              }
            : {
                weekday: "short" as const,
                month: "short" as const,
                day: "numeric" as const,
                year: "numeric" as const,
              };
      return date.toLocaleString("en-US", fullFormat);
    };

    return overviewTimeSeries.buckets.map(
      (bucket: JobsOverviewTimeSeriesBucket) => {
        const bucketDate = new Date(bucket.bucketStart);
        return {
          timeKey: bucket.timeKey,
          name: formatAxisLabel(bucketDate, queueChartTimeframe),
          fullDate: formatTooltipLabel(bucketDate, queueChartTimeframe),
          dispatched: bucket.dispatched,
          completed: bucket.completed,
          failed: bucket.failed,
        };
      },
    );
  }, [overviewTimeSeries, queueChartTimeframe]);

  const systemLoad = useMemo(() => {
    if (!overview) return "—";

    const totalCapacity = Math.max(totalWorkers * 5, 1);
    const loadRatio = queueDepth / totalCapacity;

    if (loadRatio < 0.5) return "Optimal";
    if (loadRatio < 1) return "Balanced";
    if (loadRatio < 1.5) return "Elevated";
    return "High";
  }, [overview, queueDepth, totalWorkers]);

  const recentActivity = overview?.recentJobs?.slice(0, 5) ?? [];

  return (
    <div className="relative w-full min-w-0 space-y-8 pb-10 z-0">
      {/* Decorative Top-Right Grid Background */}
      <div className="fixed top-0 left-1/2 h-screen w-screen -translate-x-1/2 pointer-events-none -z-50 overflow-hidden">
        <div
          className="absolute inset-y-0 right-0 left-[20%] bg-[linear-gradient(to_right,rgba(99,102,241,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.15)_1px,transparent_1px)]"
          style={{
            backgroundSize: "50px 50px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 100% 0%, #000 70%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 100% 0%, #000 70%, transparent 100%)",
          }}
        />
        <div className="absolute right-0 top-0 h-150 w-150 -translate-y-1/3 translate-x-1/3 rounded-full bg-indigo-600/20 blur-[120px]" />
      </div>

      {/* Top Welcome Title */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Crawlix <span className="text-indigo-500">Control Center</span>
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            Infrastructure is operational ·{" "}
            {overview?.queueName || "Cluster Disconnected"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-[#1a2235] bg-[#0c1220] px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-[#1a2235] transition-all"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Sync Data
          </button>
          <Link
            href="/dispatcher"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
          >
            <Zap className="size-4" />
            Dispatch
          </Link>
        </div>
      </div>

      {/* Hero Header */}
      <div className="relative w-full overflow-hidden rounded-[2rem] border border-indigo-500/20 bg-[#0c1220] p-6 shadow-2xl md:p-12">
        {/* Abstract Background Element */}
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/5 blur-[80px]" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-600/5 blur-[80px]" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="min-w-0 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-bold text-indigo-400 uppercase tracking-widest">
              <Activity className="size-3.5" /> Live Optimization
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white leading-[1.1] tracking-tight">
              Scale your scraping <br />{" "}
              <span className="text-indigo-500">beyond limits.</span>
            </h2>
            <p className="text-base text-slate-400 leading-relaxed max-w-lg">
              Real-time queue status from the active cluster.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <QuickStat icon={Cpu} label="System Load" value={systemLoad} />
              <QuickStat
                icon={Globe}
                label="Active Workers"
                value={`${consumerCount} Active`}
              />
              <QuickStat
                icon={Database}
                label="Queue Backlog"
                value={`${queueDepth} Jobs`}
              />
            </div>
          </div>

          <div className="hidden min-w-0 lg:block">
            <div className="rounded-2xl border border-[#1a2235] bg-[#070b14]/80 p-6 backdrop-blur-sm shadow-inner">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <Terminal className="size-4" /> Throughput Live
                </span>
                <div className="flex gap-1">
                  <div className="h-1.5 w-4 rounded-full bg-indigo-500" />
                  <div className="h-1.5 w-1.5 rounded-full bg-[#1a2235]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-[#1a2235]" />
                </div>
              </div>
              <div className="h-50 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <Bar
                      dataKey="completed"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                      barSize={30}
                    />
                    <XAxis dataKey="name" hide />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{
                        backgroundColor: "#0c1220",
                        border: "1px solid #1a2235",
                        borderRadius: "8px",
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-[#1a2235] pt-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    Avg Response
                  </span>
                  <span className="text-lg font-bold text-white">420ms</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    Success Rate
                  </span>
                  <span className="text-lg font-bold text-emerald-400">
                    99.2%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-8">
        {/* Top Row: Stats & Quick Actions */}
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <div className="grid gap-5 sm:grid-cols-2">
              {[
                {
                  label: "Queue Records",
                  value: totalJobs.toLocaleString(),
                  icon: Database,
                  trend: "+12.5%",
                  color: "text-indigo-400",
                  bg: "bg-indigo-500/10",
                },
                {
                  label: "Worker Nodes",
                  value: String(activeWorkers),
                  icon: ServerCog,
                  trend: "Live",
                  color: "text-amber-400",
                  bg: "bg-amber-500/10",
                },
                {
                  label: "Total Success",
                  value: completed.toLocaleString(),
                  icon: CheckCircle2,
                  trend: "+8.2%",
                  color: "text-emerald-400",
                  bg: "bg-emerald-500/10",
                },
                {
                  label: "Fail Incident",
                  value: failed.toLocaleString(),
                  icon: Activity,
                  trend: "-2.1%",
                  color: "text-rose-400",
                  bg: "bg-rose-500/10",
                },
              ].map(({ label, value, icon: Icon, trend, color, bg }) => (
                <div
                  key={label}
                  className="group relative min-w-0 overflow-hidden rounded-2xl border border-[#1a2235] bg-[#0c1220] p-6 transition-all hover:border-indigo-500/30"
                >
                  <div
                    className={cn(
                      "mb-4 flex h-10 w-10 items-center justify-center rounded-xl",
                      bg,
                      color,
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-3xl font-bold text-white tracking-tight">
                      {value}
                    </h3>
                    <span
                      className={cn(
                        "text-xs font-bold",
                        color.includes("rose")
                          ? "text-rose-400"
                          : "text-emerald-400",
                      )}
                    >
                      {trend}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 lg:col-span-1">
            {/* Quick Actions */}
            <div className="space-y-4 h-full">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">
                Control Hub
              </h3>
              <div className="grid gap-3">
                {QUICK_ACTIONS.map(
                  ({ href, icon: Icon, label, color, iconBg }) => (
                    <Link
                      key={href}
                      href={href}
                      className="group flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-[#1a2235] bg-[#0c1220] p-4 transition-all hover:border-indigo-500/30 hover:bg-[#131b2c]"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
                            iconBg,
                            color,
                          )}
                        >
                          <Icon className="size-5" />
                        </div>
                        <span className="min-w-0 truncate font-bold text-sm text-slate-200">
                          {label}
                        </span>
                      </div>
                      <ArrowRight className="size-4 text-slate-600 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                    </Link>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Queue Volume & Live Feed */}
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2 flex flex-col">
            <div className="rounded-[1.5rem] border border-[#1a2235] bg-[#0c1220] p-6 flex-1 flex flex-col overflow-hidden">
              <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Queue Volume</h3>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <div className="size-2 rounded-full bg-indigo-500" />{" "}
                      Dispatched
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <div className="size-2 rounded-full bg-emerald-500" />{" "}
                      Completed
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <div className="size-2 rounded-full bg-rose-500" /> Failed
                    </span>
                  </div>
                  <Select
                    value={queueChartTimeframe}
                    onValueChange={(value) => {
                      const newTimeframe = value as QueueChartTimeframe;
                      setQueueChartTimeframe(newTimeframe);
                      void loadOverviewTimeSeries(newTimeframe);
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-xl border-[#1a2235] bg-[#121828] text-slate-200 sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#1a2235] bg-[#121828] text-slate-200">
                      {QUEUE_CHART_TIMEFRAMES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="min-h-60 flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="#1a2235"
                      vertical={false}
                    />
                    <defs>
                      <linearGradient
                        id="gradCompleted"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#10b981"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#10b981"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="gradDispatched"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#6366f1"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="timeKey"
                      stroke="#1a2235"
                      tick={{ fill: "#475569", fontSize: 11, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                      tickFormatter={(value) => {
                        type ChartItem = (typeof chartData)[0];
                        const entry = chartData.find(
                          (item: ChartItem) => item.timeKey === value,
                        );
                        return entry?.name ?? "";
                      }}
                    />
                    <YAxis hide />
                    <Tooltip
                      labelFormatter={(_, payload) => {
                        const firstItem = payload?.[0] as {
                          payload?: { fullDate?: string };
                        };
                        return firstItem?.payload?.fullDate ?? "";
                      }}
                      contentStyle={{
                        backgroundColor: "#0c1220",
                        borderColor: "#1a2235",
                        borderRadius: "12px",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="dispatched"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fill="url(#gradDispatched)"
                    />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      stroke="#10b981"
                      strokeWidth={3}
                      fill="url(#gradCompleted)"
                    />
                    <Area
                      type="monotone"
                      dataKey="failed"
                      stroke="#f43f5e"
                      strokeWidth={3}
                      fill="none"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-1 flex flex-col">
            {/* Recent Table */}
            <div className="rounded-[1.5rem] border border-[#1a2235] bg-[#0c1220] overflow-hidden flex-1 flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-[#1a2235]">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Live Feed
                </h3>
                <Link
                  href="/jobs"
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
                >
                  History
                </Link>
              </div>
              <div className="divide-y divide-[#1a2235] overflow-y-auto">
                {recentActivity.map((job) => (
                  <div
                    key={job.jobId}
                    className="group cursor-pointer p-4 transition-colors hover:bg-[#131b2c]"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="truncate text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
                        {job.url}
                      </span>
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          job.status === "completed"
                            ? "bg-emerald-500"
                            : "bg-amber-500",
                        )}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>{job.jobId.slice(0, 8)}</span>
                      <span className="capitalize">{job.status}</span>
                    </div>
                  </div>
                ))}
                {recentActivity.length === 0 && (
                  <div className="p-10 text-center text-slate-500 text-xs">
                    Waiting for stream...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#334155]/20 text-slate-400">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
          {label}
        </p>
        <p className="text-sm font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
