"use client";

import { LoaderCircle } from "lucide-react";
import { useDashboardSession } from "@/components/page/dashboard/session-provider";
import { LoginPanel } from "@/app/login-panel";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const {
    admin,
    authLoading,
    email,
    setEmail,
    password,
    setPassword,
    handleLogin,
    loggingIn,
    loginError,
  } = useDashboardSession();

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b14]">
        <div className="flex items-center gap-3 rounded-full border border-[#1a2235] bg-[#0c1220] px-5 py-3 text-sm text-slate-400">
          <LoaderCircle className="size-4 animate-spin" />
          Checking session...
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

  return <>{children}</>;
}
