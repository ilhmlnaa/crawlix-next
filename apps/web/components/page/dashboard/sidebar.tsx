"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Crosshair,
  KeyRound,
  LayoutDashboard,
  Rabbit,
  ServerCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Overview" },
  { href: "/dispatcher", icon: Crosshair, label: "Dispatcher" },
  { href: "/jobs", icon: Rabbit, label: "Queue Items" },
  { href: "/workers", icon: ServerCog, label: "Workers" },
  { href: "/keys", icon: KeyRound, label: "API Keys" },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-20 border-r border-[#1a2235] bg-[#0c1220] hidden xl:flex flex-col items-center py-6 gap-8 z-40 relative shrink-0">
      {/* Logo */}
      <div className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg">
        <Image
          src="/logo.png"
          alt="Crawlix Logo"
          width={60}
          height={60}
          className=""
        />
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-6 w-full items-center mt-4">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "group relative p-3.5 rounded-full cursor-pointer transition-all duration-200 shadow-md",
                isActive
                  ? "bg-indigo-600 text-white shadow-indigo-600/30"
                  : "bg-transparent text-[#6b7280] hover:text-white hover:bg-[#1a2235]",
              )}
            >
              <Icon className="size-5" />
              {/* Tooltip */}
              <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 rounded-lg bg-[#0c1220] border border-[#1a2235] px-3 py-1.5 text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/** Mobile bottom nav */
export function DashboardBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="xl:hidden fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-[#1a2235] bg-[#0c1220]/95 backdrop-blur-md px-2">
      {navItems.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-colors",
              isActive ? "text-indigo-400" : "text-[#6b7280]",
            )}
          >
            <Icon className="size-5" />
            <span className="text-[10px]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
