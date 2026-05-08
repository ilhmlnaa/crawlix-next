"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe2, LockKeyhole, Network, Save, ServerCog, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDashboardSession } from "@/components/page/dashboard/session-provider";
import type { ProxyPolicy } from "@repo/queue-contracts";

function toTextareaValue(policy?: ProxyPolicy | null) {
  return policy?.proxies.join("\n") ?? "";
}

function parseProxyLines(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function ProxySettingsPage() {
  const {
    proxySettings,
    loadingProxySettings,
    savingProxySettings,
    handleSaveGlobalProxyPolicy,
    handleDeleteGlobalProxyPolicy,
    handleSaveWorkerServiceProxyPolicy,
    handleDeleteWorkerServiceProxyPolicy,
  } = useDashboardSession();
  const globalPolicy =
    proxySettings?.policies.find((policy) => policy.scopeType === "global") ??
    null;
  const workerPolicies = useMemo(
    () =>
      (proxySettings?.policies ?? []).filter(
        (policy) => policy.scopeType === "workerService",
      ),
    [proxySettings],
  );
  const [globalEnabled, setGlobalEnabled] = useState(Boolean(globalPolicy?.enabled));
  const [globalProxyText, setGlobalProxyText] = useState(toTextareaValue(globalPolicy));
  const [selectedService, setSelectedService] = useState("");
  const [serviceEnabled, setServiceEnabled] = useState(false);
  const [serviceProxyText, setServiceProxyText] = useState("");
  const [serviceDraftDirty, setServiceDraftDirty] = useState(false);

  useEffect(() => {
    setGlobalEnabled(Boolean(globalPolicy?.enabled));
    setGlobalProxyText(toTextareaValue(globalPolicy));
  }, [globalPolicy]);

  useEffect(() => {
    if (!selectedService && proxySettings?.availableWorkerServices?.length) {
      setSelectedService(proxySettings.availableWorkerServices[0] ?? "");
    }
  }, [proxySettings?.availableWorkerServices, selectedService]);

  useEffect(() => {
    const currentPolicy =
      workerPolicies.find((policy) => policy.scopeKey === selectedService) ?? null;
    if (serviceDraftDirty) {
      return;
    }
    setServiceEnabled(Boolean(currentPolicy?.enabled));
    setServiceProxyText(toTextareaValue(currentPolicy));
  }, [selectedService, serviceDraftDirty, workerPolicies]);

  const envLocked = proxySettings?.envOverrideActive ?? false;
  const availableServices = proxySettings?.availableWorkerServices ?? [];

  return (
    <div className="w-full min-w-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">
            Proxy <span className="text-indigo-500">Control</span>
          </h1>
          <p className="text-sm text-slate-500">
            Manage cluster-wide and per-service proxy pools with forced env override awareness.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="rounded-full border border-[#1a2235] bg-[#0c1220] px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">
            {loadingProxySettings ? "Syncing" : "Synced"}
          </Badge>
          {envLocked ? (
            <Badge className="rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
              Env Override Active
            </Badge>
          ) : (
            <Badge className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-300">
              Frontend Policies Active
            </Badge>
          )}
        </div>
      </div>

      <section className="rounded-[2rem] border border-[#1a2235] bg-[#0c1220] p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <LockKeyhole className="size-4 text-amber-400" />
              <h2 className="text-lg font-black text-white">Effective Env Override</h2>
            </div>
            <p className="text-sm text-slate-500">
              If worker env proxies exist, runtime execution ignores frontend policy and uses env round-robin.
            </p>
          </div>
          <Badge className="rounded-full border border-[#1a2235] bg-[#121828] px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">
            Pool {proxySettings?.envPolicy.poolSize ?? 0}
          </Badge>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[#1a2235] bg-[#121828] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-slate-500">
              <Network className="size-3.5" />
              Env Proxies
            </div>
            {proxySettings?.envPolicy.proxies.length ? (
              <div className="space-y-2 font-mono text-xs text-slate-300">
                {proxySettings.envPolicy.proxies.map((proxyUrl) => (
                  <div
                    key={proxyUrl}
                    className="rounded-xl border border-[#1a2235] bg-[#0c1220] px-3 py-2 break-all"
                  >
                    {proxyUrl}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#1a2235] bg-[#0c1220] px-4 py-6 text-sm text-slate-500">
                No env proxy pool detected.
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-[#1a2235] bg-[#121828] p-4 text-sm text-slate-400">
            <p className="font-semibold text-white">Precedence</p>
            <p className="mt-3">1. Env proxy pool</p>
            <p>2. Worker service policy</p>
            <p>3. Entire cluster policy</p>
            <p>4. Legacy job-level proxy option</p>
            <p>5. Direct connection</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[2rem] border border-[#1a2235] bg-[#0c1220] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Globe2 className="size-4 text-indigo-400" />
                <h2 className="text-lg font-black text-white">Entire Cluster</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Default proxy pool for the whole cluster when no per-service policy matches.
              </p>
            </div>
            {envLocked && (
              <Badge className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
                Locked by Env
              </Badge>
            )}
          </div>
          <div className="mt-6 space-y-4">
            <label className="flex items-center justify-between rounded-2xl border border-[#1a2235] bg-[#121828] px-4 py-3">
              <span className="text-sm font-medium text-slate-200">Enable global proxy pool</span>
              <input
                type="checkbox"
                checked={globalEnabled}
                disabled={envLocked || savingProxySettings}
                onChange={(event) => setGlobalEnabled(event.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
            </label>
            <textarea
              value={globalProxyText}
              disabled={envLocked || savingProxySettings || !globalEnabled}
              onChange={(event) => setGlobalProxyText(event.target.value)}
              placeholder={"http://user:pass@ip:port\nhttp://ip:port"}
              className="min-h-48 w-full rounded-2xl border border-[#1a2235] bg-[#121828] px-4 py-3 font-mono text-sm text-slate-200 outline-none placeholder:text-slate-600 disabled:opacity-50"
            />
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={envLocked || savingProxySettings}
                onClick={() =>
                  handleSaveGlobalProxyPolicy({
                    enabled: globalEnabled,
                    mode: globalEnabled ? "pool" : "direct",
                    proxies: parseProxyLines(globalProxyText),
                  })
                }
                className="rounded-full bg-indigo-600 px-5 text-white hover:bg-indigo-500"
              >
                <Save className="mr-2 size-4" />
                Save Global Policy
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={envLocked || savingProxySettings}
                onClick={() => void handleDeleteGlobalProxyPolicy()}
                className="rounded-full border-[#1a2235] bg-transparent text-slate-300"
              >
                <Trash2 className="mr-2 size-4" />
                Delete Policy
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#1a2235] bg-[#0c1220] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ServerCog className="size-4 text-cyan-400" />
                <h2 className="text-lg font-black text-white">Per Worker Service</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Apply a dedicated proxy pool to a worker service name before global fallback.
              </p>
            </div>
            <Badge className="rounded-full border border-[#1a2235] bg-[#121828] px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">
              {workerPolicies.length} Policies
            </Badge>
          </div>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
                Worker service name
              </label>
              <Input
                list="worker-service-options"
                value={selectedService}
                disabled={envLocked || savingProxySettings}
                onChange={(event) => {
                  setSelectedService(event.target.value);
                  setServiceDraftDirty(false);
                }}
                placeholder="crawlix-worker"
                className="h-11 rounded-2xl border-[#1a2235] bg-[#121828] text-slate-200"
              />
              <datalist id="worker-service-options">
                {availableServices.map((serviceName) => (
                  <option key={serviceName} value={serviceName} />
                ))}
              </datalist>
            </div>
            <label className="flex items-center justify-between rounded-2xl border border-[#1a2235] bg-[#121828] px-4 py-3">
              <span className="text-sm font-medium text-slate-200">Enable service proxy pool</span>
              <input
                type="checkbox"
                checked={serviceEnabled}
                disabled={envLocked || savingProxySettings || !selectedService}
                onChange={(event) => {
                  setServiceEnabled(event.target.checked);
                  setServiceDraftDirty(true);
                }}
                className="h-4 w-4 accent-cyan-500"
              />
            </label>
            <textarea
              value={serviceProxyText}
              disabled={
                envLocked ||
                savingProxySettings ||
                !selectedService ||
                !serviceEnabled
              }
              onChange={(event) => {
                setServiceProxyText(event.target.value);
                setServiceDraftDirty(true);
              }}
              placeholder={"http://user:pass@ip:port\nhttp://ip:port"}
              className="min-h-48 w-full rounded-2xl border border-[#1a2235] bg-[#121828] px-4 py-3 font-mono text-sm text-slate-200 outline-none placeholder:text-slate-600 disabled:opacity-50"
            />
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={envLocked || savingProxySettings || !selectedService.trim()}
                onClick={() =>
                  void handleSaveWorkerServiceProxyPolicy(selectedService, {
                    enabled: serviceEnabled,
                    mode: serviceEnabled ? "pool" : "direct",
                    proxies: parseProxyLines(serviceProxyText),
                  }).then(() => {
                    setServiceDraftDirty(false);
                  })
                }
                className="rounded-full bg-cyan-600 px-5 text-white hover:bg-cyan-500"
              >
                <Save className="mr-2 size-4" />
                Save Service Policy
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={envLocked || savingProxySettings || !selectedService.trim()}
                onClick={() =>
                  void handleDeleteWorkerServiceProxyPolicy(selectedService).then(() => {
                    setServiceDraftDirty(false);
                    setServiceEnabled(false);
                    setServiceProxyText("");
                  })
                }
                className="rounded-full border-[#1a2235] bg-transparent text-slate-300"
              >
                <Trash2 className="mr-2 size-4" />
                Delete Policy
              </Button>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-[2rem] border border-[#1a2235] bg-[#0c1220] p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-white">Saved Policies</h2>
            <p className="text-sm text-slate-500">
              Stored policy records currently available to workers through Redis.
            </p>
          </div>
        </div>
        {workerPolicies.length === 0 && !globalPolicy ? (
          <div className="rounded-2xl border border-dashed border-[#1a2235] bg-[#121828] p-8 text-sm text-slate-500">
            No frontend proxy policy has been saved yet.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {globalPolicy ? (
              <PolicyCard
                title="Entire Cluster"
                subtitle="global"
                policy={globalPolicy}
                onUse={() => {
                  setGlobalEnabled(Boolean(globalPolicy.enabled));
                  setGlobalProxyText(toTextareaValue(globalPolicy));
                }}
              />
            ) : null}
            {workerPolicies.map((policy) => (
              <PolicyCard
                key={policy.id}
                title={policy.scopeKey ?? "worker service"}
                subtitle="workerService"
                policy={policy}
                onUse={() => {
                  setSelectedService(policy.scopeKey ?? "");
                  setServiceEnabled(Boolean(policy.enabled));
                  setServiceProxyText(toTextareaValue(policy));
                  setServiceDraftDirty(false);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PolicyCard({
  title,
  subtitle,
  policy,
  onUse,
}: {
  title: string;
  subtitle: string;
  policy: ProxyPolicy;
  onUse: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#1a2235] bg-[#121828] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            {subtitle}
          </p>
        </div>
        <Badge className="rounded-full border border-[#1a2235] bg-[#0c1220] px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-300">
          {policy.enabled ? `${policy.proxies.length} Proxies` : "Direct"}
        </Badge>
      </div>
      <div className="mt-4 space-y-2 font-mono text-xs text-slate-300">
        {policy.proxies.length ? (
          policy.proxies.map((proxyUrl) => (
            <div
              key={proxyUrl}
              className="rounded-xl border border-[#1a2235] bg-[#0c1220] px-3 py-2 break-all"
            >
              {proxyUrl}
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[#1a2235] bg-[#0c1220] px-3 py-4 text-slate-500">
            Direct mode
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Updated by {policy.updatedBy}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onUse}
          className="rounded-full border border-[#1a2235] bg-[#0c1220] px-3 text-slate-300 hover:bg-[#1a2235]"
        >
          Use in editor
        </Button>
      </div>
    </div>
  );
}
