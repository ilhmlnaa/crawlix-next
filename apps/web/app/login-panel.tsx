"use client";

import { KeyRound, LoaderCircle, ServerCog, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
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

export function LoginPanel({
  email,
  password,
  setEmail,
  setPassword,
  onSubmit,
  loading,
  error,
}: {
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.14),_transparent_24%),linear-gradient(180deg,_#fcfbf7_0%,_#f5f2ea_45%,_#f7f5ef_100%)] px-4 py-10 md:px-8">
      <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <Badge className="rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-primary">
            Crawlix Admin Access
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-balance text-foreground">
              Dashboard operasional untuk memantau queue, worker aktif, retry, dan dead-letter queue.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Login admin dibutuhkan agar panel kontrol tetap aman. Setelah masuk, dashboard akan
              memakai session cookie HTTP-only untuk semua endpoint internal.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              title="Surface"
              value="Session"
              hint="Akses admin manusia dijaga lewat cookie HTTP-only."
              icon={ShieldCheck}
            />
            <MetricCard
              title="Clients"
              value="API Keys"
              hint="Client programmatic memakai API key yang bisa direvoke."
              icon={KeyRound}
            />
            <MetricCard
              title="Workers"
              value="Tracked"
              hint="Heartbeat aktif akan muncul setelah login berhasil."
              icon={ServerCog}
            />
          </div>
        </section>

        <Card className="border-white/70 bg-white/92 shadow-[0_32px_120px_-50px_rgba(15,23,42,0.55)]">
          <CardHeader>
            <CardTitle className="text-2xl">Masuk ke control center</CardTitle>
            <CardDescription>Gunakan seeded admin dari environment API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Email admin</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none transition focus:border-primary"
                placeholder="admin@crawlix.local"
                type="email"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Password</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-border bg-white px-4 py-3 outline-none transition focus:border-primary"
                placeholder="Password admin"
                type="password"
              />
            </label>
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
            <Button className="w-full rounded-full" onClick={onSubmit} disabled={loading}>
              {loading ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 size-4" />
              )}
              Login dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
