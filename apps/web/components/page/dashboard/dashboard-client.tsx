"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LogOut,
  PanelTop,
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
import { LoginPanel } from "@/app/login-panel";
import { ApiKeyPanel } from "./api-key-panel";

function formatRelativeTime(value?: string): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusBadgeClass(status: ScrapeJobRecord["status"]) {
  if (status === "completed") {
    return "border-border bg-primary/15 text-primary";
  }

  if (status === "processing") {
    return "border-border bg-accent/25 text-accent-foreground";
  }

  if (status === "failed") {
    return "border-border bg-destructive/15 text-destructive";
  }

  if (status === "cancelled") {
    return "border-border bg-muted text-muted-foreground";
  }

  return "border-border bg-secondary text-secondary-foreground";
}

function workerBadgeClass(status: WorkerHeartbeat["status"]) {
  return status === "processing"
    ? "border-border bg-accent/25 text-accent-foreground"
    : "border-border bg-muted text-muted-foreground";
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
    <Card className="border-border/60 bg-card/90">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardDescription className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/90">
            {title}
          </CardDescription>
          <CardTitle className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {value}
          </CardTitle>
        </div>
        <div className="rounded-lg border border-border/70 bg-primary/10 p-2.5 text-primary">
          <Icon className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground md:text-sm">{hint}</p>
      </CardContent>
    </Card>
  );
}

function WorkerCard({ worker }: { worker: WorkerHeartbeat }) {
  return (
    <Card className="border-border/60 bg-card/90">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm md:text-base">
              {worker.serviceName}
            </CardTitle>
            <CardDescription className="text-xs">
              {worker.workerId}
            </CardDescription>
          </div>
          <Badge
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs",
              workerBadgeClass(worker.status),
            )}
          >
            {worker.status}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground md:text-sm">
          <div>Host: {worker.hostname}</div>
          <div>PID: {worker.pid}</div>
          <div>Processed: {worker.processedCount}</div>
          <div>Failed: {worker.failedCount}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground md:text-sm">
        <div className="rounded-lg bg-muted px-3 py-2.5">
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

  const loadOverview = useCallback(async () => {
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
  }, [apiBaseUrl]);

  const loadApiKeys = useCallback(async () => {
    setLoadingApiKeys(true);
    const keys = await fetchJson<ApiKeyRecord[]>(
      `${apiBaseUrl}/admin/api-keys`,
    );
    setApiKeys(keys ?? []);
    setLoadingApiKeys(false);
  }, [apiBaseUrl]);

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
      setLoginError("Invalid admin email or password.");
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
  }, [apiBaseUrl, loadApiKeys, loadOverview]);

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
  }, [admin, apiBaseUrl, loadOverview]);

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
  const totalWorkers = overview?.workers.length ?? 0;
  const activeWorkers =
    overview?.workers.filter((worker) => worker.status === "processing")
      .length ?? 0;
  const idleWorkers = Math.max(totalWorkers - activeWorkers, 0);
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
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-card px-5 py-3 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Checking dashboard session...
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_36%),radial-gradient(circle_at_80%_0%,rgba(34,197,94,0.08),transparent_30%),var(--color-background)] px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-2xl border border-border/60 bg-card/90 p-5 md:p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground">
                  Operations
                </Badge>
                <Badge className="rounded-full border border-border bg-primary/15 px-3 py-1 text-xs text-primary">
                  Live monitor
                </Badge>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Crawlix Admin Dashboard
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
                A unified control surface for queue throughput, worker activity,
                and job-level troubleshooting.
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto">
              <div className="rounded-xl border border-border/70 bg-muted/45 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Signed in as
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {admin.email}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/45 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Queue target
                </p>
                <p className="mt-1 truncate text-sm font-medium text-foreground">
                  {overview?.queueName ?? "API disconnected"}
                </p>
              </div>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  className="rounded-full"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw
                    className={cn("mr-2 size-4", refreshing && "animate-spin")}
                  />
                  Sync data
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-full"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Tracked jobs"
            value={String(totalJobs)}
            hint="Records loaded in the current snapshot window."
            icon={Rabbit}
          />
          <MetricCard
            title="Active workers"
            value={String(activeWorkers)}
            hint={`Idle workers: ${idleWorkers}.`}
            icon={ServerCog}
          />
          <MetricCard
            title="Completion"
            value={String(completed)}
            hint="Successfully processed jobs in this cycle."
            icon={CheckCircle2}
          />
          <MetricCard
            title="Failures"
            value={String(failed)}
            hint="Jobs currently requiring intervention."
            icon={AlertTriangle}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-12">
          <Card className="border-border/60 bg-card/90 xl:col-span-8">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-2xl">Recent jobs</CardTitle>
                  <CardDescription>
                    Browse incoming jobs and drill into details on the right
                    panel.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <PanelTop className="size-4" />
                  Auto-refresh every 10s
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-128 rounded-xl border border-border/60 bg-background/70">
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
                          "cursor-pointer transition-colors hover:bg-muted/70",
                          selectedJobId === job.jobId && "bg-muted",
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
                        <TableCell className="max-w-88 truncate text-foreground/90">
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

          <div className="grid gap-6 xl:col-span-4">
            <Card className="border-border/60 bg-card/90">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">Queue health</CardTitle>
                    <CardDescription>
                      Distribution and saturation indicators.
                    </CardDescription>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-primary/10 p-2.5 text-primary">
                    <Activity className="size-5" />
                  </div>
                </div>
                <Separator />
              </CardHeader>
              <CardContent className="space-y-5">
                <QueueProgress
                  label="Queued"
                  value={queued}
                  total={totalJobs}
                />
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
                <QueueProgress
                  label="Failed"
                  value={failed}
                  total={totalJobs}
                />
                <QueueProgress
                  label="Cancelled"
                  value={cancelled}
                  total={totalJobs}
                />
                <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/45 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Queue depth</span>
                    <span className="font-medium text-foreground">
                      {overview?.queueDepth ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Consumers</span>
                    <span className="font-medium text-foreground">
                      {overview?.consumerCount ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Retry queue</span>
                    <span className="font-medium text-foreground">
                      {retryQueueDepth}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Dead-letter</span>
                    <span className="font-medium text-foreground">
                      {deadLetterQueueDepth}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/90">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">Worker fleet</CardTitle>
                    <CardDescription>
                      Heartbeat and throughput per worker instance.
                    </CardDescription>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-accent/20 p-2.5 text-accent-foreground">
                    <Clock3 className="size-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {overview?.workers.length ? (
                  <ScrollArea className="h-80 pr-1">
                    <div className="grid gap-3">
                      {overview.workers.map((worker) => (
                        <WorkerCard key={worker.workerId} worker={worker} />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                    No worker heartbeat detected yet. Start the worker service
                    to populate this panel.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-12">
          <Card className="border-border/60 bg-card/90 xl:col-span-7">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">Job details</CardTitle>
                  <CardDescription>
                    Payload, metadata, and recovery actions for the selected
                    job.
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
                  <div className="grid gap-3 rounded-2xl bg-muted p-4 text-sm md:grid-cols-2">
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
                    <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-5 py-5 text-sm text-muted-foreground">
                      <LoaderCircle className="size-4 animate-spin" />
                      Loading job result...
                    </div>
                  ) : selectedResult ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 text-sm md:grid-cols-2">
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
                          <p className="text-muted-foreground">Content type</p>
                          <p className="mt-1 font-medium text-foreground">
                            {selectedResult.contentType ?? "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Response time</p>
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
                            {selectedResult.cached ? "Yes" : "No"}
                          </p>
                        </div>
                      </div>

                      {selectedResult.error ? (
                        <div className="rounded-2xl border border-border bg-destructive/10 px-4 py-4 text-sm text-destructive">
                          {selectedResult.error}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          Preview
                        </p>
                        <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4 text-sm leading-7 text-muted-foreground">
                          {selectedResult.preview ??
                            selectedResult.content?.slice(0, 500) ??
                            "No preview available"}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          Raw content snippet
                        </p>
                        <ScrollArea className="h-56 rounded-2xl border border-border/70 bg-muted px-4 py-4">
                          <pre className="whitespace-pre-wrap wrap-break-word font-mono text-xs leading-6 text-foreground/90">
                            {selectedResult.content?.slice(0, 4000) ??
                              "No content stored"}
                          </pre>
                        </ScrollArea>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-8 text-center text-sm text-muted-foreground">
                      Result data is not available yet. If the status is still
                      queued or processing, wait for the next refresh.
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-8 text-center text-sm text-muted-foreground">
                  Select a job from the table to view details.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:col-span-5">
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

            <Card className="border-border/60 bg-card/90">
              <CardHeader>
                <CardTitle className="text-xl">Operational notes</CardTitle>
                <CardDescription>
                  Practical guidance for daily cluster operations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                  The main queue receives new workload. Retry queue keeps
                  recoverable jobs before re-dispatch. Dead-letter queue stores
                  jobs that exceeded retry thresholds.
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                  Docker and VM workers can run in parallel when connected to
                  the same RabbitMQ and Redis infrastructure.
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                  Assign one API key per client integration to isolate
                  revocations and reduce blast radius.
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
