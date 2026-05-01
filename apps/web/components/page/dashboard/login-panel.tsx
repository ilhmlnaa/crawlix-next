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
import { Input } from "@/components/ui/input";

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
    <Card className="min-w-0 border-[#1a2235] bg-[#0c1220]/90 shadow-xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardDescription className="text-xs uppercase tracking-[0.25em] text-slate-500">
            {title}
          </CardDescription>
          <CardTitle className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {value}
          </CardTitle>
        </div>
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-indigo-300">
          <Icon className="size-5" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-400">{hint}</p>
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
  onSubmit: () => void | Promise<void>;
  loading: boolean;
  error: string | null;
}) {
  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    void onSubmit();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b14] px-4 py-8 md:px-8 md:py-10">
      <div className="pointer-events-none absolute -top-24 right-[-10%] h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-[-10%] h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative mx-auto grid min-h-[84vh] w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <section className="min-w-0 space-y-6 lg:space-y-7">
          <Badge className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1 text-indigo-300">
            Crawlix Admin Access
          </Badge>
          <div className="space-y-3">
            <h1 className="max-w-2xl text-4xl font-black tracking-tight text-white md:text-5xl">
              Secure operations for your crawling cluster.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-400 md:text-lg">
              Sign in to monitor queue health, workers, and dispatch tasks in
              real time.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              title="Surface"
              value="Session"
              hint="Human admin access is protected with HTTP-only cookies."
              icon={ShieldCheck}
            />
            <MetricCard
              title="Clients"
              value="API Keys"
              hint="Programmatic clients use revocable API keys."
              icon={KeyRound}
            />
            <MetricCard
              title="Workers"
              value="Tracked"
              hint="Worker heartbeat and load appear after sign-in."
              icon={ServerCog}
            />
          </div>
        </section>

        <Card className="min-w-0 border-[#1a2235] bg-[#0c1220] shadow-2xl">
          <CardHeader className="space-y-2 px-7 pt-7">
            <CardTitle className="text-2xl font-black tracking-tight text-white">
              Sign in to Control Center
            </CardTitle>
            <CardDescription className="text-slate-500">
              Use admin credentials from your API environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-7 sm:pb-7">
            <form className="space-y-5" onSubmit={handleFormSubmit}>
              <label className="block space-y-2 text-sm">
                <span className="font-medium text-slate-400">Admin email</span>
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 rounded-xl border-[#1a2235] bg-[#121828] text-slate-200 placeholder:text-slate-600 focus-visible:ring-indigo-500"
                  placeholder="admin@crawlix.local"
                  type="email"
                  autoComplete="username"
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-medium text-slate-400">Password</span>
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-xl border-[#1a2235] bg-[#121828] text-slate-200 placeholder:text-slate-600 focus-visible:ring-indigo-500"
                  placeholder="Admin password"
                  type="password"
                  autoComplete="current-password"
                />
              </label>

              {error ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-500"
                disabled={loading}
              >
                {loading ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 size-4" />
                )}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
