import { getWebRuntimeConfig } from "@repo/config";
import { DashboardClient } from "./dashboard-client";

export default async function Home() {
  const { apiBaseUrl } = getWebRuntimeConfig();

  return <DashboardClient apiBaseUrl={apiBaseUrl} initialOverview={null} />;
}
