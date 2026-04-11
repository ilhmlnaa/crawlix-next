"use client";

import {
  ServerCog,
  Cpu,
  Activity,
  Clock,
  Terminal,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDashboardSession } from "@/components/page/dashboard/session-provider";
import { cn } from "@/lib/utils";

function formatRelativeTime(val?: string) {
  if (!val) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(val));
}

export function WorkersPage() {
  const { overview } = useDashboardSession();
  const workers = overview?.workers ?? [];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">
            Fleet <span className="text-indigo-500">Surveillance</span>
          </h1>
          <p className="text-sm text-slate-500">
            Real-time health and task distribution across the cluster.
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs bg-[#0c1220] border border-[#1a2235] rounded-2xl px-6 py-3 shadow-inner">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="font-bold text-slate-300">
              {workers.filter((w) => w.status === "idle").length} Idle
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
            <span className="font-bold text-slate-300">
              {workers.filter((w) => w.status === "processing").length} Busy
            </span>
          </div>
        </div>
      </div>

      {workers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-[#1a2235] bg-[#0c1220] p-24 text-center">
          <ServerCog className="mb-6 size-16 text-slate-700 stroke-1 opacity-40" />
          <h3 className="text-xl font-bold text-white mb-2">Cluster Silent</h3>
          <p className="text-sm text-slate-500 max-w-sm">
            No worker nodes detected. Protocol suggests immediate node
            deployment to handle pending queue payloads.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {workers.map((worker) => (
            <div
              key={worker.workerId}
              className="group relative rounded-[2rem] border border-[#1a2235] bg-[#0c1220] p-1 transition-all hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/5"
            >
              <div className="p-6 space-y-6">
                {/* Top Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                      <Cpu className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white text-base truncate">
                        {worker.serviceName}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">
                        {worker.hostname}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={cn(
                      "rounded-full border border-transparent px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                      worker.status === "processing"
                        ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                        : "bg-slate-800 text-slate-500",
                    )}
                  >
                    {worker.status}
                  </Badge>
                </div>

                {/* Meta Info Grid */}
                <div className="grid grid-cols-2 gap-px bg-[#1a2235] rounded-2xl overflow-hidden border border-[#1a2235]">
                  <MetaItem
                    icon={Activity}
                    label="Processed"
                    value={worker.processedCount}
                  />
                  <MetaItem
                    icon={ShieldCheck}
                    label="Fails"
                    value={worker.failedCount}
                    color="text-rose-400"
                  />
                  <MetaItem icon={Terminal} label="PID" value={worker.pid} />
                  <MetaItem icon={Clock} label="Uptime" value="Live" />
                </div>

                {/* Current Operation */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                      Active Operation
                    </span>
                    {worker.currentJobId && (
                      <span className="text-[10px] text-indigo-500 animate-pulse font-bold tracking-widest uppercase">
                        Executing
                      </span>
                    )}
                  </div>
                  <div className="rounded-2xl border border-[#334155]/30 bg-[#121828] p-4 font-mono text-xs overflow-hidden">
                    {worker.currentJobId ? (
                      <span className="text-indigo-300 break-all">
                        {worker.currentJobId}
                      </span>
                    ) : (
                      <span className="text-slate-600 italic">
                        Phase: Listening for stream...
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Sync */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-[#1a2235] pt-4 px-1">
                  <span className="flex items-center gap-1.5 uppercase tracking-widest font-bold">
                    <div className="size-1 rounded-full bg-emerald-500" />{" "}
                    Heartbeat
                  </span>
                  <span className="font-bold text-slate-400">
                    {formatRelativeTime(worker.lastSeenAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | React.ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-[#0c1220] p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 opacity-40">
        <Icon className="size-3 text-slate-400" />
        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
      <span
        className={cn("text-sm font-bold tracking-tight text-slate-200", color)}
      >
        {String(value)}
      </span>
    </div>
  );
}
