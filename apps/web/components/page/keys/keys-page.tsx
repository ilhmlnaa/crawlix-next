"use client";

import { useDashboardSession } from "@/components/page/dashboard/session-provider";
import { ApiKeyPanel } from "@/components/shared/api-key-panel";

export function KeysPage() {
  const {
    apiKeys,
    loadingApiKeys,
    creatingApiKey,
    revokingKeyId,
    deletingKeyId,
    newKeyLabel,
    setNewKeyLabel,
    newApiKeyValue,
    copiedNewApiKey,
    handleCreateApiKey,
    handleCopyNewApiKey,
    handleDismissNewApiKey,
    handleRevokeApiKey,
    handleDeleteApiKey,
  } = useDashboardSession();

  return (
    <ApiKeyPanel
      apiKeys={apiKeys}
      loadingApiKeys={loadingApiKeys}
      creatingApiKey={creatingApiKey}
      revokingKeyId={revokingKeyId}
      deletingKeyId={deletingKeyId}
      newKeyLabel={newKeyLabel}
      setNewKeyLabel={setNewKeyLabel}
      newApiKeyValue={newApiKeyValue}
      copiedNewApiKey={copiedNewApiKey}
      onCreate={handleCreateApiKey}
      onCopyNewKey={handleCopyNewApiKey}
      onDismissNewKey={handleDismissNewApiKey}
      onRevoke={handleRevokeApiKey}
      onDelete={handleDeleteApiKey}
    />
  );
}
