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
        <div className="flex xl:h-screen min-h-screen bg-[#070b14] text-slate-300 font-sans selection:bg-indigo-500/30">
          <DashboardSidebar />
          <main className="flex-1 flex flex-col min-w-0 xl:h-screen overflow-y-auto overflow-x-hidden relative">
            <DashboardNavbar />
            <div className="flex-1 p-5 pb-24 xl:pb-8 lg:p-10 lg:pt-8 w-full max-w-400 mx-auto animate-in fade-in slide-in-from-bottom-4 duration-400">
              {children}
            </div>
          </main>
          <DashboardBottomNav />
        </div>
      </AuthGate>
    </DashboardSessionProvider>
  );
}
