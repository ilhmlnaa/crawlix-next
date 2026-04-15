"use client";

import {
  Copy,
  EyeOff,
  InfinityIcon,
  KeyRound,
  LoaderCircle,
  ShieldBan,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ApiKeyRecord } from "@repo/queue-contracts";

function formatRelativeTime(value?: string): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ApiKeyPanel({
  apiKeys,
  loadingApiKeys,
  creatingApiKey,
  revokingKeyId,
  deletingKeyId,
  newKeyLabel,
  setNewKeyLabel,
  newKeyRateLimit,
  setNewKeyRateLimit,
  newApiKeyValue,
  copiedNewApiKey,
  onCreate,
  onCopyNewKey,
  onDismissNewKey,
  onRevoke,
  onDelete,
}: {
  apiKeys: ApiKeyRecord[];
  loadingApiKeys: boolean;
  creatingApiKey: boolean;
  revokingKeyId: string | null;
  deletingKeyId: string | null;
  newKeyLabel: string;
  setNewKeyLabel: (value: string) => void;
  newKeyRateLimit: number | null;
  setNewKeyRateLimit: (value: number | null) => void;
  newApiKeyValue: string | null;
  copiedNewApiKey: boolean;
  onCreate: () => void;
  onCopyNewKey: () => void;
  onDismissNewKey: () => void;
  onRevoke: (keyId: string) => void;
  onDelete: (keyId: string) => void;
}) {
  return (
    <div className="w-full min-w-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1 min-w-0">
        <h2 className="text-2xl font-bold text-white">API Integration Keys</h2>
        <p className="text-sm text-slate-500">
          Secure programmatic access to the Crawlix engine for external
          services.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,2.05fr)]">
        <div className="lg:col-span-1">
          <Card className="min-w-0 border-[#1a2235] bg-[#0c1220] shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg text-white">
                Generate New Key
              </CardTitle>
              <CardDescription className="text-slate-500">
                Identifiers for your scraper clients or automated pipelines.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Client Label
                </label>
                <input
                  value={newKeyLabel}
                  onChange={(event) => setNewKeyLabel(event.target.value)}
                  className="w-full rounded-xl border border-[#1a2235] bg-[#121828] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-indigo-500"
                  placeholder="e.g. Marketing Crawler"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Rate Limit (requests/minute)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newKeyRateLimit ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setNewKeyRateLimit(
                        value === "" ? null : parseInt(value, 10),
                      );
                    }}
                    className="flex-1 rounded-xl border border-[#1a2235] bg-[#121828] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-indigo-500"
                    placeholder="Leave empty for unlimited"
                    min="1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border border-[#1a2235] bg-[#121828] px-4 py-6 text-slate-300 hover:bg-[#1a2235]"
                    onClick={() => setNewKeyRateLimit(null)}
                    title="Set to unlimited"
                  >
                    <InfinityIcon className="size-5" />
                  </Button>
                </div>
              </div>
              <Button
                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/20"
                onClick={onCreate}
                disabled={creatingApiKey || newKeyLabel.trim().length < 3}
              >
                {creatingApiKey ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 size-4" />
                )}
                Generate Key
              </Button>

              {newApiKeyValue && (
                <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                      Secret Value Ready
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500 leading-relaxed">
                      Copy this now. It will not be shown again for security
                      reasons.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1 rounded-lg bg-[#1a2235] text-slate-200 border-[#334155]/50 hover:bg-[#252e44]"
                      size="sm"
                      onClick={onCopyNewKey}
                    >
                      <Copy className="mr-2 size-3.5" />
                      {copiedNewApiKey ? "Copied!" : "Copy"}
                    </Button>
                    <Button
                      variant="secondary"
                      className="rounded-lg bg-[#1a2235] text-slate-200 border-[#334155]/50 hover:bg-[#252e44]"
                      size="sm"
                      onClick={onDismissNewKey}
                    >
                      <EyeOff className="size-3.5" />
                    </Button>
                  </div>
                  <div className="rounded border border-[#334155]/40 bg-[#070b14] p-3 font-mono text-[11px] break-all text-indigo-300">
                    {newApiKeyValue}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 lg:col-span-2">
          <Card className="min-w-0 overflow-hidden border-[#1a2235] bg-[#0c1220]">
            <CardHeader className="border-b border-[#1a2235]">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-white">Active Credentials</span>
                <Badge className="bg-[#1a2235] text-slate-400 border-[#334155] font-normal">
                  {apiKeys.length} keys total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-112 max-w-full min-w-0">
                <Table>
                  <TableHeader className="bg-[#121828]/50">
                    <TableRow className="border-[#1a2235]">
                      <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11">
                        Label
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11">
                        Status
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11">
                        Rate Limit
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11">
                        Preview
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11">
                        Recent Activity
                      </TableHead>
                      <TableHead className="text-right pr-6 h-11"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((apiKey) => (
                      <TableRow
                        key={apiKey.keyId}
                        className="border-[#1a2235] hover:bg-[#1a2235]/40 transition-colors"
                      >
                        <TableCell className="font-semibold text-slate-200">
                          {apiKey.label}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase",
                              apiKey.status === "active"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-slate-800 text-slate-500 border-slate-700",
                            )}
                          >
                            {apiKey.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400 font-mono">
                          {apiKey.rateLimit === null ||
                          apiKey.rateLimit === undefined
                            ? "∞ Unlimited"
                            : `${apiKey.rateLimit}/min`}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-400">
                          {apiKey.keyPreview}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {formatRelativeTime(apiKey.lastUsedAt)}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800 rounded-md"
                              disabled={
                                apiKey.status === "revoked" ||
                                revokingKeyId === apiKey.keyId
                              }
                              onClick={() => onRevoke(apiKey.keyId)}
                              title="Revoke Key"
                            >
                              {revokingKeyId === apiKey.keyId ? (
                                <LoaderCircle className="size-3.5 animate-spin" />
                              ) : (
                                <ShieldBan className="size-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-md"
                              disabled={deletingKeyId === apiKey.keyId}
                              onClick={() => onDelete(apiKey.keyId)}
                              title="Delete Key"
                            >
                              {deletingKeyId === apiKey.keyId ? (
                                <LoaderCircle className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loadingApiKeys && apiKeys.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-20 text-center text-slate-500 text-sm"
                        >
                          <KeyRound className="size-10 mx-auto mb-3 opacity-20" />
                          <p>No integration keys found.</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
