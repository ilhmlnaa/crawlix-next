import { getWebRuntimeConfig } from "@repo/config";
import { DashboardClient } from "@/components/page/dashboard/dashboard-client";

export default async function Home() {
  const { apiBaseUrl } = getWebRuntimeConfig();

  return <DashboardClient apiBaseUrl={apiBaseUrl} initialOverview={null} />;
}
