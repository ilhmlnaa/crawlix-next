"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { ScrapeWaitUntil } from "@repo/queue-contracts";

interface AdvancedOptionsProps {
  method: string;
  onMethodChange: (value: string) => void;
  waitUntil: ScrapeWaitUntil;
  onWaitUntilChange: (value: ScrapeWaitUntil) => void;
  timeoutMs: string;
  onTimeoutMsChange: (value: string) => void;
  maxRetries: string;
  onMaxRetriesChange: (value: string) => void;
  retryDelayMs: string;
  onRetryDelayMsChange: (value: string) => void;
  cacheTtlSeconds: string;
  onCacheTtlSecondsChange: (value: string) => void;
  additionalDelayMs: string;
  onAdditionalDelayMsChange: (value: string) => void;
  waitForSelector: string;
  onWaitForSelectorChange: (value: string) => void;
  waitForFunction: string;
  onWaitForFunctionChange: (value: string) => void;
  proxyUrl: string;
  onProxyUrlChange: (value: string) => void;
  useCache: boolean;
  onUseCacheChange: (value: boolean) => void;
  useProxy: boolean;
  onUseProxyChange: (value: boolean) => void;
}

interface FieldLabelProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function FieldLabel({ label, description, children }: FieldLabelProps) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 block">
        {label}
      </label>
      {description && (
        <p className="text-[9px] text-slate-600">{description}</p>
      )}
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full rounded-lg border border-[#1a2235] bg-[#121828] px-3 py-1.5 flex items-center justify-between text-left"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
        {label}
      </span>
      <span
        className={
          value
            ? "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300"
            : "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-slate-700/50 text-slate-400"
        }
      >
        {value ? "On" : "Off"}
      </span>
    </button>
  );
}

export function AdvancedOptions({
  method,
  onMethodChange,
  waitUntil,
  onWaitUntilChange,
  timeoutMs,
  onTimeoutMsChange,
  maxRetries,
  onMaxRetriesChange,
  retryDelayMs,
  onRetryDelayMsChange,
  cacheTtlSeconds,
  onCacheTtlSecondsChange,
  additionalDelayMs,
  onAdditionalDelayMsChange,
  waitForSelector,
  onWaitForSelectorChange,
  waitForFunction,
  onWaitForFunctionChange,
  proxyUrl,
  onProxyUrlChange,
  useCache,
  onUseCacheChange,
  useProxy,
  onUseProxyChange,
}: AdvancedOptionsProps) {
  return (
    <details className="group rounded-2xl border border-[#1a2235] bg-[#070b14]/60">
      <summary className="flex list-none cursor-pointer items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-indigo-400" />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
            Advanced Configuration
          </span>
        </div>
        <ChevronDown className="size-4 text-slate-500 transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-6 border-t border-[#1a2235] px-4 pb-4 pt-4">
        {/* HTTP Settings */}
        <div>
          <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">
            HTTP Settings
          </h5>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label="Method" description="HTTP method to use">
              <Select
                value={method}
                onValueChange={(value) => onMethodChange(value ?? "GET")}
              >
                <SelectTrigger className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#121828] border-[#1a2235] text-slate-200">
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </FieldLabel>

            <FieldLabel
              label="Timeout (ms)"
              description="Request timeout in milliseconds"
            >
              <Input
                value={timeoutMs}
                onChange={(e) => onTimeoutMsChange(e.target.value)}
                type="number"
                min={1}
                placeholder="30000"
                className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl"
              />
            </FieldLabel>
          </div>
        </div>

        {/* Retry Settings */}
        <div>
          <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">
            Retry Strategy
          </h5>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel
              label="Max Retries"
              description="Maximum retry attempts"
            >
              <Input
                value={maxRetries}
                onChange={(e) => onMaxRetriesChange(e.target.value)}
                type="number"
                min={0}
                placeholder="2"
                className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl"
              />
            </FieldLabel>

            <FieldLabel
              label="Retry Delay (ms)"
              description="Delay between retries"
            >
              <Input
                value={retryDelayMs}
                onChange={(e) => onRetryDelayMsChange(e.target.value)}
                type="number"
                min={0}
                placeholder="1000"
                className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl"
              />
            </FieldLabel>
          </div>
        </div>

        {/* Cache Settings */}
        <div>
          <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">
            Cache Configuration
          </h5>
          <div className="space-y-3">
            <FieldLabel
              label="Cache TTL (seconds)"
              description="How long to cache response"
            >
              <Input
                value={cacheTtlSeconds}
                onChange={(e) => onCacheTtlSecondsChange(e.target.value)}
                type="number"
                min={1}
                placeholder="900"
                disabled={!useCache}
                className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl disabled:opacity-50"
              />
            </FieldLabel>

            <ToggleRow
              label="Enable Response Cache"
              value={useCache}
              onChange={onUseCacheChange}
            />
          </div>
        </div>

        {/* Browser Settings */}
        <div>
          <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">
            Browser & Rendering
          </h5>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label="Wait Until" description="Wait for page event">
              <Select
                value={waitUntil}
                onValueChange={(value) =>
                  onWaitUntilChange(
                    (value ?? "domcontentloaded") as ScrapeWaitUntil,
                  )
                }
              >
                <SelectTrigger className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#121828] border-[#1a2235] text-slate-200">
                  <SelectItem value="load">load</SelectItem>
                  <SelectItem value="domcontentloaded">
                    domcontentloaded
                  </SelectItem>
                  <SelectItem value="networkidle">networkidle</SelectItem>
                  <SelectItem value="commit">commit</SelectItem>
                </SelectContent>
              </Select>
            </FieldLabel>

            <FieldLabel
              label="Additional Delay (ms)"
              description="Extra wait time after load"
            >
              <Input
                value={additionalDelayMs}
                onChange={(e) => onAdditionalDelayMsChange(e.target.value)}
                type="number"
                min={0}
                placeholder="0"
                className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl"
              />
            </FieldLabel>

            <FieldLabel
              label="Wait For Selector"
              description="CSS selector to wait for"
            >
              <Input
                value={waitForSelector}
                onChange={(e) => onWaitForSelectorChange(e.target.value)}
                placeholder="e.g. #main-content, .loaded"
                className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl"
              />
            </FieldLabel>

            <FieldLabel
              label="Wait For Function"
              description="JS function that returns boolean"
            >
              <Input
                value={waitForFunction}
                onChange={(e) => onWaitForFunctionChange(e.target.value)}
                placeholder="e.g. () => window.__READY__ === true"
                className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl"
              />
            </FieldLabel>
          </div>
        </div>

        {/* Proxy Settings */}
        <div>
          <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-3">
            Proxy Configuration
          </h5>
          <div className="space-y-3">
            <FieldLabel label="Proxy URL" description="HTTP proxy endpoint">
              <Input
                value={proxyUrl}
                onChange={(e) => onProxyUrlChange(e.target.value)}
                placeholder="http://ip:port"
                disabled={!useProxy}
                className="bg-[#121828] border-[#1a2235] text-slate-200 h-11 rounded-xl disabled:opacity-50"
              />
            </FieldLabel>

            <ToggleRow
              label="Enable Proxy"
              value={useProxy}
              onChange={onUseProxyChange}
            />
          </div>
        </div>
      </div>
    </details>
  );
}
