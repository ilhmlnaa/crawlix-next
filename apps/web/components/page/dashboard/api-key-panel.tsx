"use client";

import { KeyRound, LoaderCircle, Trash2 } from "lucide-react";
import type { ApiKeyRecord } from "@repo/queue-contracts";
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

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function keyStatusClass(status: ApiKeyRecord["status"]) {
  return status === "active"
    ? "border-border bg-primary/15 text-primary"
    : "border-border bg-muted text-muted-foreground";
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
    <Card className="border-border/60 bg-card/90">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl">API key management</CardTitle>
          <Badge className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {apiKeys.length} total
          </Badge>
        </div>
        <CardDescription>
          Create, monitor, and revoke credentials for programmatic scraper
          clients.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={newKeyLabel}
              onChange={(event) => setNewKeyLabel(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-ring"
              placeholder="Client label"
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
            <div className="mt-4 rounded-xl border border-border bg-primary/10 px-4 py-4 text-sm">
              <p className="font-medium text-foreground">New API key</p>
              <p className="mt-2 break-all font-mono text-xs leading-6 text-foreground/90">
                {newApiKeyValue}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Save this value now. It is only shown once at creation.
              </p>
            </div>
          ) : null}
        </div>

        <ScrollArea className="h-80 rounded-xl border border-border/60 bg-background/70">
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
                <TableRow key={apiKey.keyId} className="hover:bg-muted/60">
                  <TableCell className="font-medium">{apiKey.label}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs",
                        keyStatusClass(apiKey.status),
                      )}
                    >
                      {apiKey.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {apiKey.keyPreview}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(apiKey.lastUsedAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="secondary"
                      className="rounded-full"
                      size="sm"
                      disabled={
                        apiKey.status === "revoked" ||
                        revokingKeyId === apiKey.keyId
                      }
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
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No API keys yet. Create one to connect your first client.
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
