import Link from "next/link";

const quickLinks = [
  {
    title: "API Reference",
    description: "Public job endpoints, health checks, and integration flow.",
    href: "/docs/api",
  },
  {
    title: "Worker Runtime",
    description:
      "Queue execution, heartbeat, browser runtime, and scaling notes.",
    href: "/docs/worker",
  },
  {
    title: "Deployment Guide",
    description: "Docker, hybrid workers, and production infrastructure setup.",
    href: "/docs/deployment",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col px-6 py-16 md:px-10">
      <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center rounded-full border border-fd-border bg-fd-card/80 px-3 py-1 text-sm text-fd-muted-foreground shadow-sm">
            Crawlix Next Documentation
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-fd-foreground md:text-6xl">
              Queue-first scraping platform docs for API, workers, and
              operations.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-fd-muted-foreground md:text-lg">
              Crawlix Next combines NestJS, Next.js, RabbitMQ, and Redis into a
              scalable scraping platform with isolated workers, retry and DLQ
              flow, API-key based integrations, and an internal operator
              dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/docs"
              className="inline-flex items-center rounded-xl bg-fd-primary px-5 py-3 text-sm font-medium text-fd-primary-foreground shadow-sm transition hover:opacity-90"
            >
              Open Docs
            </Link>
            <Link
              href="/docs/api/jobs"
              className="inline-flex items-center rounded-xl border border-fd-border bg-fd-card px-5 py-3 text-sm font-medium text-fd-foreground transition hover:bg-fd-accent"
            >
              View API Examples
            </Link>
          </div>
          <div className="grid gap-3 text-sm text-fd-muted-foreground md:grid-cols-3">
            <div className="rounded-2xl border border-fd-border bg-fd-card/70 p-4">
              <p className="font-medium text-fd-foreground">Async Jobs</p>
              <p className="mt-1">
                API only accepts and tracks jobs. Workers do the heavy work.
              </p>
            </div>
            <div className="rounded-2xl border border-fd-border bg-fd-card/70 p-4">
              <p className="font-medium text-fd-foreground">Worker Fleet</p>
              <p className="mt-1">
                Scale Docker and VM workers together on the same queue.
              </p>
            </div>
            <div className="rounded-2xl border border-fd-border bg-fd-card/70 p-4">
              <p className="font-medium text-fd-foreground">Ops Ready</p>
              <p className="mt-1">
                Heartbeat, queue depth, retry, DLQ, and health endpoints
                included.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-fd-border bg-linear-to-br from-fd-card via-fd-card to-fd-secondary/70 p-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-fd-foreground">
                  System Overview
                </p>
                <p className="text-sm text-fd-muted-foreground">
                  Production-oriented docs map
                </p>
              </div>
              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
                Ready
              </div>
            </div>
            <div className="space-y-3">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-2xl border border-fd-border bg-fd-background/80 p-4 transition hover:border-fd-primary/30 hover:bg-fd-accent/60"
                >
                  <p className="font-medium text-fd-foreground">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-fd-muted-foreground">
                    {item.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
