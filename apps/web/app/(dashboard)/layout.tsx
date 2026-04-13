import { getWebRuntimeConfig } from "@repo/config";
import { DashboardSessionProvider } from "@/components/page/dashboard/session-provider";
import {
  DashboardSidebar,
  DashboardBottomNav,
} from "@/components/page/dashboard/sidebar";
import { DashboardNavbar } from "@/components/page/dashboard/navbar";
import { AuthGate } from "@/components/page/dashboard/auth-gate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { apiBaseUrl } = getWebRuntimeConfig();

  return (
    <DashboardSessionProvider apiBaseUrl={apiBaseUrl}>
      <AuthGate>
        <div className="flex min-h-screen w-full overflow-x-clip bg-[#070b14] text-slate-300 font-sans selection:bg-indigo-500/30 xl:h-screen">
          <DashboardSidebar />
          <main className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto xl:h-screen">
            <DashboardNavbar />
            <div className="mx-auto flex w-full min-w-0 flex-1 max-w-screen-2xl p-4 pb-24 sm:p-6 lg:p-8 xl:pb-8 animate-in fade-in slide-in-from-bottom-4 duration-400">
              {children}
            </div>
          </main>
          <DashboardBottomNav />
        </div>
      </AuthGate>
    </DashboardSessionProvider>
  );
}
