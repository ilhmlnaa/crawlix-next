"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LogOut,
  Rabbit,
  RefreshCw,
  RotateCcw,
  ServerCog,
  ShieldX,
} from "lucide-react";
import type { ComponentType } from "react";
import type {
  ApiKeyRecord,
  AuthenticatedAdmin,
  CreateApiKeyResponse,
  EnqueueJobResponse,
  JobsOverviewSnapshot,
  ScrapeJobRecord,
  ScrapeJobResult,
  WorkerHeartbeat,
} from "@repo/queue-contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ApiKeyPanel } from "./api-key-panel";
import { LoginPanel } from "./login-panel";

function formatRelativeTime(value?: string): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusBadgeClass(status: ScrapeJobRecord["status"]) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-100 text-emerald-700";
  }

  if (status === "processing") {
    return "border-sky-200 bg-sky-100 text-sky-700";
  }

  if (status === "failed") {
    return "border-rose-200 bg-rose-100 text-rose-700";
  }

  if (status === "cancelled") {
    return "border-zinc-300 bg-zinc-100 text-zinc-700";
  }

  return "border-amber-200 bg-amber-100 text-amber-700";
}

function workerBadgeClass(status: WorkerHeartbeat["status"]) {
  return status === "processing"
    ? "border-sky-200 bg-sky-100 text-sky-700"
    : "border-zinc-200 bg-zinc-100 text-zinc-700";
}

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-white/70 bg-white/85 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.5)] backdrop-blur">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardDescription className="text-xs uppercase tracking-[0.25em] text-muted-foreground/80">
            {title}
          </CardDescription>
          <CardTitle className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </CardTitle>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function WorkerCard({ worker }: { worker: WorkerHeartbeat }) {
  return (
    <Card className="border-white/70 bg-white/90 shadow-[0_24px_80px_-45px_rgba(15,23,42,0.5)]">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{worker.serviceName}</CardTitle>
            <CardDescription>{worker.workerId}</CardDescription>
          </div>
          <Badge
            className={cn(
              "rounded-full border px-3 py-1",
              workerBadgeClass(worker.status),
            )}
          >
            {worker.status}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          <div>Host: {worker.hostname}</div>
          <div>PID: {worker.pid}</div>
          <div>Processed: {worker.processedCount}</div>
          <div>Failed: {worker.failedCount}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="rounded-2xl bg-secondary/70 px-4 py-3">
          Current job:{" "}
          {worker.currentJobId ? worker.currentJobId.slice(0, 12) : "idle"}
        </div>
        <div>Last heartbeat: {formatRelativeTime(worker.lastSeenAt)}</div>
      </CardContent>
    </Card>
  );
}

function QueueProgress({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const progress = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">
          {value} ({progress}%)
        </span>
      </div>
      <Progress value={progress} className="h-2.5 bg-secondary" />
    </div>
  );
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      credentials: "include",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function DashboardClient({
  apiBaseUrl,
  initialOverview,
}: {
  apiBaseUrl: string;
  initialOverview: JobsOverviewSnapshot | null;
}) {
  const [admin, setAdmin] = useState<AuthenticatedAdmin | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [overview, setOverview] = useState<JobsOverviewSnapshot | null>(
    initialOverview,
  );
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    initialOverview?.recentJobs[0]?.jobId ?? null,
  );
  const [selectedResult, setSelectedResult] = useState<ScrapeJobResult | null>(
    null,
  );
  const [loadingResult, setLoadingResult] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [newKeyLabel, setNewKeyLabel] = useState("Default scraper client");
  const [newApiKeyValue, setNewApiKeyValue] = useState<string | null>(null);

  const loadOverview = async () => {
    const snapshot = await fetchJson<JobsOverviewSnapshot>(
      `${apiBaseUrl}/jobs/overview`,
    );
    if (snapshot) {
      startTransition(() => {
        setOverview(snapshot);
        setSelectedJobId(
          (current) => current ?? snapshot.recentJobs[0]?.jobId ?? null,
        );
      });
    }
  };

  const loadApiKeys = async () => {
    setLoadingApiKeys(true);
    const keys = await fetchJson<ApiKeyRecord[]>(
      `${apiBaseUrl}/admin/api-keys`,
    );
    setApiKeys(keys ?? []);
    setLoadingApiKeys(false);
  };

  const handleLogin = async () => {
    setLoggingIn(true);
    setLoginError(null);
    const response = await fetchJson<{ admin: AuthenticatedAdmin }>(
      `${apiBaseUrl}/auth/login`,
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );

    if (!response?.admin) {
      setLoginError("Email atau password admin tidak valid.");
      setLoggingIn(false);
      return;
    }

    setAdmin(response.admin);
    setPassword("");
    await Promise.all([loadOverview(), loadApiKeys()]);
    setLoggingIn(false);
  };

  const handleLogout = async () => {
    await fetchJson(`${apiBaseUrl}/auth/logout`, {
      method: "POST",
    });
    setAdmin(null);
    setOverview(null);
    setSelectedJobId(null);
    setSelectedResult(null);
    setApiKeys([]);
    setNewApiKeyValue(null);
  };

  const handleCreateApiKey = async () => {
    setCreatingApiKey(true);
    const created = await fetchJson<CreateApiKeyResponse>(
      `${apiBaseUrl}/admin/api-keys`,
      {
        method: "POST",
        body: JSON.stringify({ label: newKeyLabel }),
      },
    );

    if (created) {
      setNewApiKeyValue(created.apiKey);
      await loadApiKeys();
    }

    setCreatingApiKey(false);
  };

  const handleRevokeApiKey = async (keyId: string) => {
    setRevokingKeyId(keyId);
    await fetchJson<ApiKeyRecord>(
      `${apiBaseUrl}/admin/api-keys/${keyId}/revoke`,
      {
        method: "POST",
      },
    );
    await loadApiKeys();
    setRevokingKeyId(null);
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setAuthLoading(true);
      const me = await fetchJson<{ admin: AuthenticatedAdmin }>(
        `${apiBaseUrl}/auth/me`,
      );
      if (cancelled) {
        return;
      }

      if (me?.admin) {
        setAdmin(me.admin);
        await Promise.all([loadOverview(), loadApiKeys()]);
      } else {
        setAdmin(null);
      }

      setAuthLoading(false);
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!admin) {
      return;
    }

    const runRefresh = async () => {
      setRefreshing(true);
      await loadOverview();
      setRefreshing(false);
    };

    const interval = setInterval(() => {
      void runRefresh();
    }, 10_000);

    return () => clearInterval(interval);
  }, [admin, apiBaseUrl]);

  useEffect(() => {
    if (!admin || !selectedJobId) {
      setSelectedResult(null);
      return;
    }

    let cancelled = false;

    const loadResult = async () => {
      setLoadingResult(true);
      const result = await fetchJson<ScrapeJobResult>(
        `${apiBaseUrl}/jobs/${selectedJobId}/result`,
      );

      if (!cancelled) {
        setSelectedResult(result);
        setLoadingResult(false);
      }
    };

    void loadResult();

    return () => {
      cancelled = true;
    };
  }, [admin, apiBaseUrl, selectedJobId]);

  const totalJobs = overview?.total ?? 0;
  const completed = overview?.statusCounts.completed ?? 0;
  const processing = overview?.statusCounts.processing ?? 0;
  const failed = overview?.statusCounts.failed ?? 0;
  const cancelled = overview?.statusCounts.cancelled ?? 0;
  const queued = overview?.statusCounts.queued ?? 0;
  const retryQueueDepth = overview?.retryQueueDepth ?? 0;
  const deadLetterQueueDepth = overview?.deadLetterQueueDepth ?? 0;
  const activeWorkers =
    overview?.workers.filter((worker) => worker.status === "processing")
      .length ?? 0;
  const selectedJob = useMemo(
    () =>
      overview?.recentJobs.find((job) => job.jobId === selectedJobId) ?? null,
    [overview, selectedJobId],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadOverview(), loadApiKeys()]);
    setRefreshing(false);
  };

  const handleRetry = async (jobId: string) => {
    setRetryingJobId(jobId);
    const retried = await fetchJson<EnqueueJobResponse>(
      `${apiBaseUrl}/jobs/${jobId}/retry`,
      {
        method: "POST",
      },
    );

    if (retried) {
      await handleRefresh();
      setSelectedJobId(retried.jobId);
    }

    setRetryingJobId(null);
  };

  const handleCancel = async (jobId: string) => {
    setCancellingJobId(jobId);
    await fetchJson<ScrapeJobRecord>(`${apiBaseUrl}/jobs/${jobId}/cancel`, {
      method: "POST",
    });
    await handleRefresh();
    setCancellingJobId(null);
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fcfbf7_0%,#f5f2ea_45%,#f7f5ef_100%)]">
        <div className="flex items-center gap-3 rounded-full border border-white/70 bg-white/85 px-5 py-3 text-sm text-muted-foreground shadow-sm">
          <LoaderCircle className="size-4 animate-spin" />
          Memeriksa session dashboard...
        </div>
      </main>
    );
  }

  if (!admin) {
    return (
      <LoginPanel
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        onSubmit={handleLogin}
        loading={loggingIn}
        error={loginError}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.14),transparent_24%),linear-gradient(180deg,#fcfbf7_0%,#f5f2ea_45%,#f7f5ef_100%)] px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(244,247,250,0.76))] p-6 shadow-[0_32px_120px_-50px_rgba(15,23,42,0.55)] backdrop-blur md:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <Badge className="rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-primary">
                Crawlix Control Center
              </Badge>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance text-foreground md:text-5xl">
                  Pantau queue, worker aktif, dan hasil scraping dari satu
                  dashboard operasional.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                  Dashboard ini melakukan refresh otomatis, menampilkan
                  heartbeat worker aktif, dan memberi aksi retry langsung dari
                  panel detail job.
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-[1.75rem] border border-white/70 bg-white/75 p-4 text-sm text-muted-foreground shadow-sm sm:grid-cols-2">
              <div>
                <p className="uppercase tracking-[0.24em]">Admin</p>
                <p className="mt-2 font-medium text-foreground">
                  {admin.email}
                </p>
              </div>
              <div>
                <p className="uppercase tracking-[0.24em]">Queue</p>
                <p className="mt-2 font-medium text-foreground">
                  {overview?.queueName ?? "API belum terhubung"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <Button
                  variant="secondary"
                  className="rounded-full"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 size-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/70 bg-white/80 px-5 py-4 shadow-sm">
          <div className="text-sm text-muted-foreground">
            Refresh otomatis setiap 10 detik untuk overview dan worker fleet.
          </div>
          <Button
            variant="secondary"
            className="rounded-full"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("mr-2 size-4", refreshing && "animate-spin")}
            />
            Refresh sekarang
          </Button>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            title="Tracked Jobs"
            value={String(totalJobs)}
            hint="Snapshot 50 job terbaru yang dibaca untuk monitoring cepat."
            icon={Rabbit}
          />
          <MetricCard
            title="Active Workers"
            value={String(activeWorkers)}
            hint="Jumlah worker yang heartbeat-nya aktif dan sedang memproses job."
            icon={ServerCog}
          />
          <MetricCard
            title="Completed"
            value={String(completed)}
            hint="Job yang selesai sukses pada snapshot dashboard saat ini."
            icon={CheckCircle2}
          />
          <MetricCard
            title="Failed"
            value={String(failed)}
            hint="Job yang gagal dan perlu investigasi atau retry."
            icon={AlertTriangle}
          />
          <MetricCard
            title="Queue Depth"
            value={String(overview?.queueDepth ?? 0)}
            hint={`Consumer broker aktif: ${overview?.consumerCount ?? 0}.`}
            icon={Activity}
          />
          <MetricCard
            title="Retry Queue"
            value={String(retryQueueDepth)}
            hint="Job recoverable yang sedang menunggu percobaan ulang."
            icon={RotateCcw}
          />
          <MetricCard
            title="DLQ"
            value={String(deadLetterQueueDepth)}
            hint="Job yang sudah melewati batas retry."
            icon={ShieldX}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-white/70 bg-white/88 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.55)]">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">Queue health</CardTitle>
                  <CardDescription>
                    Distribusi status job terbaru untuk membaca aliran queue
                    dengan cepat.
                  </CardDescription>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Activity className="size-5" />
                </div>
              </div>
              <Separator />
            </CardHeader>
            <CardContent className="space-y-6">
              <QueueProgress label="Queued" value={queued} total={totalJobs} />
              <QueueProgress
                label="Processing"
                value={processing}
                total={totalJobs}
              />
              <QueueProgress
                label="Completed"
                value={completed}
                total={totalJobs}
              />
              <QueueProgress label="Failed" value={failed} total={totalJobs} />
              <QueueProgress
                label="Cancelled"
                value={cancelled}
                total={totalJobs}
              />
              <div className="grid gap-3 rounded-[1.5rem] bg-secondary/60 p-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Idle workers</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {(overview?.workers.length ?? 0) - activeWorkers}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Consumers on broker
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {overview?.consumerCount ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Retry queue depth
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {retryQueueDepth}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Dead-letter depth
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {deadLetterQueueDepth}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/88 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.55)]">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">Worker fleet</CardTitle>
                  <CardDescription>
                    Heartbeat aktif, job yang sedang dikerjakan, dan beban tiap
                    worker.
                  </CardDescription>
                </div>
                <div className="rounded-2xl bg-accent/20 p-3 text-accent-foreground">
                  <Clock3 className="size-5" />
                </div>
              </div>
              <Separator />
            </CardHeader>
            <CardContent>
              {overview?.workers.length ? (
                <div className="grid gap-4">
                  {overview.workers.map((worker) => (
                    <WorkerCard key={worker.workerId} worker={worker} />
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border bg-secondary/40 px-6 py-8 text-center text-sm text-muted-foreground">
                  Belum ada heartbeat worker. Jalankan `pnpm dev:worker` atau
                  container worker agar dashboard bisa mendeteksi instance
                  aktif.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-white/70 bg-white/88 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.55)]">
            <CardHeader>
              <CardTitle className="text-2xl">Recent jobs</CardTitle>
              <CardDescription>
                Klik satu job untuk melihat hasil detail atau retry langsung.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-130 rounded-3xl border border-border/60 bg-white/85">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overview?.recentJobs ?? []).map((job) => (
                      <TableRow
                        key={job.jobId}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-secondary/55",
                          selectedJobId === job.jobId && "bg-secondary/65",
                        )}
                        onClick={() => setSelectedJobId(job.jobId)}
                      >
                        <TableCell className="font-medium">
                          {job.jobId.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "rounded-full border px-3 py-1",
                              statusBadgeClass(job.status),
                            )}
                          >
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="uppercase tracking-wide text-muted-foreground">
                          {job.strategy}
                        </TableCell>
                        <TableCell className="max-w-90 truncate text-foreground/85">
                          {job.url}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatRelativeTime(job.updatedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/88 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.55)]">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">Job details</CardTitle>
                  <CardDescription>
                    Result content, metadata, serta retry dan cancel action
                    untuk job terpilih.
                  </CardDescription>
                </div>
                {selectedJob ? (
                  <div className="flex gap-2">
                    {selectedJob.status === "queued" ? (
                      <Button
                        variant="secondary"
                        className="rounded-full"
                        onClick={() => handleCancel(selectedJob.jobId)}
                        disabled={cancellingJobId === selectedJob.jobId}
                      >
                        {cancellingJobId === selectedJob.jobId ? (
                          <LoaderCircle className="mr-2 size-4 animate-spin" />
                        ) : (
                          <ShieldX className="mr-2 size-4" />
                        )}
                        Cancel
                      </Button>
                    ) : null}
                    <Button
                      className="rounded-full"
                      onClick={() => handleRetry(selectedJob.jobId)}
                      disabled={retryingJobId === selectedJob.jobId}
                    >
                      {retryingJobId === selectedJob.jobId ? (
                        <LoaderCircle className="mr-2 size-4 animate-spin" />
                      ) : (
                        <RotateCcw className="mr-2 size-4" />
                      )}
                      Retry
                    </Button>
                  </div>
                ) : null}
              </div>
              <Separator />
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedJob ? (
                <>
                  <div className="grid gap-3 rounded-[1.5rem] bg-secondary/55 p-4 text-sm md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground">Job ID</p>
                      <p className="mt-1 font-medium text-foreground">
                        {selectedJob.jobId}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge
                        className={cn(
                          "mt-2 rounded-full border px-3 py-1",
                          statusBadgeClass(selectedJob.status),
                        )}
                      >
                        {selectedJob.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">URL</p>
                      <p className="mt-1 break-all font-medium text-foreground">
                        {selectedJob.url}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Updated</p>
                      <p className="mt-1 font-medium text-foreground">
                        {formatRelativeTime(selectedJob.updatedAt)}
                      </p>
                    </div>
                    {selectedJob.retriedFromJobId ? (
                      <div className="md:col-span-2">
                        <p className="text-muted-foreground">Retried from</p>
                        <p className="mt-1 font-medium text-foreground">
                          {selectedJob.retriedFromJobId}
                        </p>
                      </div>
                    ) : null}
                    {selectedJob.options.timeoutMs ? (
                      <div>
                        <p className="text-muted-foreground">Timeout</p>
                        <p className="mt-1 font-medium text-foreground">
                          {selectedJob.options.timeoutMs} ms
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {loadingResult ? (
                    <div className="flex items-center gap-3 rounded-[1.5rem] border border-border bg-white/75 px-5 py-5 text-sm text-muted-foreground">
                      <LoaderCircle className="size-4 animate-spin" />
                      Memuat result detail...
                    </div>
                  ) : selectedResult ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 rounded-[1.5rem] border border-border/70 bg-white/80 p-4 text-sm md:grid-cols-2">
                        <div>
                          <p className="text-muted-foreground">Completed</p>
                          <p className="mt-1 font-medium text-foreground">
                            {formatRelativeTime(selectedResult.completedAt)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Method</p>
                          <p className="mt-1 font-medium text-foreground">
                            {selectedResult.method ?? "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Content Type</p>
                          <p className="mt-1 font-medium text-foreground">
                            {selectedResult.contentType ?? "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Response Time</p>
                          <p className="mt-1 font-medium text-foreground">
                            {selectedResult.responseTimeMs
                              ? `${selectedResult.responseTimeMs} ms`
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Retries</p>
                          <p className="mt-1 font-medium text-foreground">
                            {selectedResult.retries ?? 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cached</p>
                          <p className="mt-1 font-medium text-foreground">
                            {selectedResult.cached ? "yes" : "no"}
                          </p>
                        </div>
                      </div>

                      {selectedResult.error ? (
                        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                          {selectedResult.error}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          Preview
                        </p>
                        <div className="rounded-[1.5rem] border border-border/70 bg-white/80 px-4 py-4 text-sm leading-7 text-muted-foreground">
                          {selectedResult.preview ??
                            selectedResult.content?.slice(0, 500) ??
                            "No preview"}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          Raw content snippet
                        </p>
                        <ScrollArea className="h-55 rounded-[1.5rem] border border-border/70 bg-zinc-950 px-4 py-4">
                          <pre className="whitespace-pre-wrap wrap-break-word font-mono text-xs leading-6 text-zinc-200">
                            {selectedResult.content?.slice(0, 4000) ??
                              "No content stored"}
                          </pre>
                        </ScrollArea>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-border bg-secondary/40 px-6 py-8 text-center text-sm text-muted-foreground">
                      Result untuk job ini belum tersedia. Jika status masih
                      `queued` atau `processing`, tunggu refresh berikutnya.
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border bg-secondary/40 px-6 py-8 text-center text-sm text-muted-foreground">
                  Pilih satu job dari tabel untuk melihat detailnya.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <ApiKeyPanel
            apiKeys={apiKeys}
            loadingApiKeys={loadingApiKeys}
            creatingApiKey={creatingApiKey}
            revokingKeyId={revokingKeyId}
            newKeyLabel={newKeyLabel}
            setNewKeyLabel={setNewKeyLabel}
            newApiKeyValue={newApiKeyValue}
            onCreate={handleCreateApiKey}
            onRevoke={handleRevokeApiKey}
          />

          <Card className="border-white/70 bg-white/88 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.55)]">
            <CardHeader>
              <CardTitle className="text-2xl">Operational notes</CardTitle>
              <CardDescription>
                Ringkasan singkat untuk operator saat membaca kondisi cluster.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="rounded-[1.5rem] border border-border/70 bg-secondary/35 p-4">
                Main queue menangani job baru. Retry queue menahan job
                recoverable sebelum dikirim ulang ke worker. DLQ menampung job
                yang sudah melebihi batas percobaan.
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-secondary/35 p-4">
                Worker dari Docker dan VM bisa muncul bersamaan selama semuanya
                terhubung ke RabbitMQ dan Redis yang sama.
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-secondary/35 p-4">
                Session dashboard hanya untuk admin manusia. API key sebaiknya
                dibuat per client agar revoke tidak memutus semua integrasi
                sekaligus.
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
