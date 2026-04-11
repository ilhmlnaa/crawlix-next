import Link from "next/link";

const docsLinks = [
  {
    eyebrow: "Integrate",
    title: "API Reference",
    description:
      "Submit jobs, poll status, and retrieve results with public endpoint examples.",
    href: "/docs/api",
  },
  {
    eyebrow: "Operate",
    title: "Worker Runtime",
    description:
      "Understand queue execution, heartbeat, browser runtime, and horizontal scaling.",
    href: "/docs/worker",
  },
  {
    eyebrow: "Deploy",
    title: "Deployment Guide",
    description:
      "Run the platform with Docker or hybrid worker hosts backed by shared RabbitMQ and Redis.",
    href: "/docs/deployment",
  },
];

const highlights = [
  {
    title: "Queue-first execution",
    description:
      "Requests stay fast because the API only validates, records, and enqueues jobs.",
  },
  {
    title: "Worker isolation",
    description:
      "Scraping strategies run in dedicated workers so browser-heavy workloads never block the API tier.",
  },
  {
    title: "Operational visibility",
    description:
      "Queue depth, DLQ, retry state, worker heartbeat, and health endpoints are part of the core platform.",
  },
  {
    title: "Production-ready boundaries",
    description:
      "Dashboard session auth, API-key access, retry queues, and deployable service separation are built in.",
  },
];

const flow = [
  "Client sends a scrape request to the API using an API key.",
  "API stores job metadata and publishes the job to RabbitMQ.",
  "Workers consume the queue, execute scraping strategies, and store state in Redis.",
  "Dashboard and clients read job status, metrics, and final results from the API.",
];

export default function HomePage() {
  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top_left,rgba(120,170,255,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(80,220,170,0.14),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent)]" />

      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col px-6 pb-20 pt-16 md:px-10 lg:pt-20">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-fd-border bg-fd-card/85 px-4 py-1.5 text-sm text-fd-muted-foreground shadow-sm backdrop-blur">
              Crawlix Next Documentation Hub
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-fd-foreground md:text-6xl">
                Build, run, and scale Crawlix Next with confidence.
              </h1>
              <p className="max-w-3xl text-base leading-8 text-fd-muted-foreground md:text-lg">
                Crawlix Next is a queue-based scraping platform built around
                NestJS, Next.js, RabbitMQ, and Redis. These docs are written for
                engineers and operators who need to integrate the API, run
                workers, ship deployments, and keep the system healthy under
                real traffic.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/docs/api/jobs"
                className="inline-flex items-center rounded-xl bg-fd-primary px-5 py-3 text-sm font-medium text-fd-primary-foreground shadow-sm transition hover:opacity-90"
              >
                Start With API Jobs
              </Link>
              <Link
                href="/docs/deployment"
                className="inline-flex items-center rounded-xl border border-fd-border bg-fd-card/80 px-5 py-3 text-sm font-medium text-fd-foreground transition hover:bg-fd-accent"
              >
                Read Deployment Guide
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {highlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-fd-border bg-fd-card/70 p-5 shadow-sm backdrop-blur"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fd-primary/80">
                    {item.title}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-fd-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-3xl border border-fd-border bg-linear-to-br from-fd-card via-fd-card to-fd-secondary/60 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-fd-foreground">
                    Platform Flow
                  </p>
                  <p className="mt-1 text-sm leading-6 text-fd-muted-foreground">
                    The core request lifecycle from API ingress to result
                    retrieval.
                  </p>
                </div>
                <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
                  Docs Live
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {flow.map((step, index) => (
                  <div
                    key={step}
                    className="flex gap-4 rounded-2xl border border-fd-border bg-fd-background/75 p-4"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fd-primary/10 text-sm font-semibold text-fd-primary">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-7 text-fd-muted-foreground">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-fd-border bg-fd-card/70 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-fd-foreground">
                    Jump Into the Docs
                  </p>
                  <p className="mt-1 text-sm text-fd-muted-foreground">
                    Pick the section that matches your current task.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {docsLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block rounded-2xl border border-fd-border bg-fd-background/70 p-4 transition hover:border-fd-primary/30 hover:bg-fd-accent/60"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fd-primary/75">
                      {item.eyebrow}
                    </p>
                    <p className="mt-2 font-medium text-fd-foreground">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-fd-muted-foreground">
                      {item.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="mt-14 rounded-[2rem] border border-fd-border bg-fd-card/60 p-6 shadow-sm backdrop-blur md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fd-primary/80">
                Who This Docs Site Is For
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-fd-foreground md:text-3xl">
                One place for integration, operations, and rollout guidance.
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-fd-border bg-fd-background/70 p-5">
                <p className="font-medium text-fd-foreground">API Consumers</p>
                <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
                  Learn how to create jobs, authenticate with API keys, and
                  retrieve results safely.
                </p>
              </div>
              <div className="rounded-2xl border border-fd-border bg-fd-background/70 p-5">
                <p className="font-medium text-fd-foreground">Platform Engineers</p>
                <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
                  Understand queue topology, worker runtime behavior, and
                  service boundaries inside the monorepo.
                </p>
              </div>
              <div className="rounded-2xl border border-fd-border bg-fd-background/70 p-5">
                <p className="font-medium text-fd-foreground">Operators</p>
                <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
                  Use the dashboard, health endpoints, and deployment notes to
                  run the system with better visibility.
                </p>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
