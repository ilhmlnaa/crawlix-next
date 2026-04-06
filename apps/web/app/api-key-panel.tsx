"use client";

import { KeyRound, LoaderCircle, Trash2 } from "lucide-react";
import type { ApiKeyRecord, CreateApiKeyResponse } from "@repo/queue-contracts";
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

function formatRelativeTime(value?: string): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function keyStatusClass(status: ApiKeyRecord["status"]) {
  return status === "active"
    ? "border-emerald-200 bg-emerald-100 text-emerald-700"
    : "border-zinc-300 bg-zinc-100 text-zinc-700";
}

export function ApiKeyPanel({
  apiKeys,
  loadingApiKeys,
  creatingApiKey,
  revokingKeyId,
  newKeyLabel,
  setNewKeyLabel,
  newApiKeyValue,
  onCreate,
  onRevoke,
}: {
  apiKeys: ApiKeyRecord[];
  loadingApiKeys: boolean;
  creatingApiKey: boolean;
  revokingKeyId: string | null;
  newKeyLabel: string;
  setNewKeyLabel: (value: string) => void;
  newApiKeyValue: string | null;
  onCreate: () => void;
  onRevoke: (keyId: string) => void;
}) {
  return (
    <Card className="border-white/70 bg-white/88 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.55)]">
      <CardHeader>
        <CardTitle className="text-2xl">API key management</CardTitle>
        <CardDescription>
          Buat, lihat, dan revoke credential client untuk endpoint scraping programmatic.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-[1.5rem] border border-border/70 bg-secondary/35 p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={newKeyLabel}
              onChange={(event) => setNewKeyLabel(event.target.value)}
              className="min-w-0 flex-1 rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none transition focus:border-primary"
              placeholder="Label client API"
            />
            <Button
              className="rounded-full"
              onClick={onCreate}
              disabled={creatingApiKey || newKeyLabel.trim().length < 3}
            >
              {creatingApiKey ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 size-4" />
              )}
              Generate key
            </Button>
          </div>
          {newApiKeyValue ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
              <p className="font-medium">API key baru</p>
              <p className="mt-2 break-all font-mono text-xs leading-6">{newApiKeyValue}</p>
              <p className="mt-2 text-xs text-emerald-700">
                Simpan nilai ini sekarang. Dashboard hanya menampilkannya saat pembuatan.
              </p>
            </div>
          ) : null}
        </div>

        <ScrollArea className="h-[320px] rounded-3xl border border-border/60 bg-white/85">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((apiKey) => (
                <TableRow key={apiKey.keyId}>
                  <TableCell className="font-medium">{apiKey.label}</TableCell>
                  <TableCell>
                    <Badge className={cn("rounded-full border px-3 py-1", keyStatusClass(apiKey.status))}>
                      {apiKey.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{apiKey.keyPreview}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(apiKey.lastUsedAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="secondary"
                      className="rounded-full"
                      size="sm"
                      disabled={apiKey.status === "revoked" || revokingKeyId === apiKey.keyId}
                      onClick={() => onRevoke(apiKey.keyId)}
                    >
                      {revokingKeyId === apiKey.keyId ? (
                        <LoaderCircle className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 size-4" />
                      )}
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loadingApiKeys && apiKeys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Belum ada API key. Buat satu key untuk client programmatic pertama.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
