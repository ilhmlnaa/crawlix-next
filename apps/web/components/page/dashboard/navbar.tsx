"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LogOut,
  RefreshCw,
  Settings,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDashboardSession } from "./session-provider";

const PAGE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/dispatcher": "Dispatcher",
  "/jobs": "Queue Items",
  "/workers": "Worker Fleet",
  "/keys": "API Tokens",
};

export function DashboardNavbar() {
  const pathname = usePathname();
  const { admin, refreshing, handleRefresh, handleLogout, overview } =
    useDashboardSession();
  const profileRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const title = PAGE_TITLES[pathname] ?? "Dashboard";

  return (
    <header className="sticky top-0 z-30 flex min-h-17.5 shrink-0 items-center justify-between gap-4 bg-[#070b14]/80 backdrop-blur-xl px-6 border-b border-[#1a2235]">
      <div className="flex items-center gap-6">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-black text-white tracking-tight uppercase italic decoration-indigo-500/50 underline-offset-4 decoration-2">
            {title}
          </h1>
          <div className="hidden sm:flex h-1 w-1 rounded-full bg-slate-700 mx-2" />
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Node Sync Active
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Techy Cluster Badge */}
        <div className="hidden md:flex items-center gap-4 bg-[#0c1220] border border-[#1a2235] px-4 py-1.5 rounded-xl shadow-inner">
          <div className="flex flex-col items-start leading-none">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
              Active Fleet
            </span>
            <span className="text-xs font-bold text-indigo-400">
              {overview?.workers.length || 0} Nodes
            </span>
          </div>
          <div className="h-6 w-px bg-[#1a2235]" />
          <div className="flex flex-col items-start leading-none">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
              Queued
            </span>
            <span className="text-xs font-bold text-white">
              {overview?.queueDepth || 0} Jobs
            </span>
          </div>
        </div>

        <div className="h-8 w-px bg-[#1a2235] hidden sm:block mx-1" />

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-500 hover:text-white hover:bg-[#1a2235] rounded-xl h-9 w-9"
            onClick={handleRefresh}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-slate-500 hover:text-white hover:bg-[#1a2235] rounded-xl h-9 w-9"
          >
            <Bell className="size-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-slate-500 hover:text-white hover:bg-[#1a2235] rounded-xl h-9 w-9"
          >
            <Settings className="size-4" />
          </Button>
        </div>

        {/* User Profile */}
        <div ref={profileRef} className="relative ml-2">
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            className="group relative outline-none"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <div className="flex items-center gap-3 bg-[#1a2235]/40 hover:bg-[#1a2235]/60 pr-4 pl-1 py-1 rounded-2xl border border-[#1a2235] transition-all group-focus-within:ring-2 group-focus-within:ring-indigo-500/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-indigo-700 shadow-lg border border-indigo-400/20">
                <ShieldCheck className="size-4 text-white" />
              </div>
              <div className="hidden lg:flex flex-col items-start leading-none gap-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-white">
                  Admin
                </span>
                <span className="text-[10px] font-medium text-slate-500 tracking-tight max-w-20 truncate">
                  {admin?.email}
                </span>
              </div>
            </div>
          </button>

          {profileOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-3 w-56 rounded-2xl border border-[#1a2235] bg-[#0c1220] p-2 text-slate-200 shadow-2xl backdrop-blur-md z-50"
            >
              <div className="px-2 py-3">
                <p className="text-sm font-black text-white uppercase tracking-tight">
                  Access Control
                </p>
                <p className="text-[11px] font-medium text-slate-500 break-all">
                  {admin?.email}
                </p>
              </div>
              <div className="h-px bg-[#1a2235] my-1" />
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  void handleLogout();
                }}
                className="w-full flex items-center rounded-lg px-3 py-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
              >
                <LogOut className="mr-2 size-4" />
                <span className="font-bold text-xs uppercase tracking-widest">
                  Sign Out Hub
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
