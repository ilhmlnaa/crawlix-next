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
    <Card className="border-border/60 bg-card/85">
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
    <main className="min-h-screen bg-background px-4 py-10 md:px-8">
      <div className="mx-auto grid min-h-[80vh] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <Badge className="rounded-full border border-border bg-primary/10 px-4 py-1 text-primary">
            Crawlix Admin Access
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-balance text-foreground">
              Secure operations dashboard for queue health, worker fleet
              visibility, and scrape job control.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Admin login is required to protect control actions. After
              authentication, the dashboard uses an HTTP-only session cookie for
              all internal endpoints.
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

        <Card className="border-border/60 bg-card/90">
          <CardHeader>
            <CardTitle className="text-2xl">
              Sign in to control center
            </CardTitle>
            <CardDescription>
              Use the seeded admin credentials from the API environment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Admin email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none transition focus:border-ring"
                placeholder="admin@crawlix.local"
                type="email"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-muted-foreground">Password</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none transition focus:border-ring"
                placeholder="Admin password"
                type="password"
              />
            </label>
            {error ? (
              <div className="rounded-xl border border-border bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <Button
              className="w-full rounded-full"
              onClick={onSubmit}
              disabled={loading}
            >
              {loading ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 size-4" />
              )}
              Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
