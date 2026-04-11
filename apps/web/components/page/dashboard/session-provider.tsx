"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  startTransition,
} from "react";
import type {
  ApiKeyRecord,
  AuthenticatedAdmin,
  CreateApiKeyResponse,
  EnqueueJobResponse,
  JobsOverviewSnapshot,
  ScrapeJobOptions,
  ScrapeJobRecord,
} from "@repo/queue-contracts";
import { toast } from "sonner";

const NEW_API_KEY_SESSION_KEY = "crawlix:new-api-key";
type SessionApiKeyReveal = { keyId: string; apiKey: string };

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      credentials: "include",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface DashboardSessionValue {
  apiBaseUrl: string;
  admin: AuthenticatedAdmin | null;
  authLoading: boolean;
  overview: JobsOverviewSnapshot | null;
  refreshing: boolean;
  apiKeys: ApiKeyRecord[];
  loadingApiKeys: boolean;
  creatingApiKey: boolean;
  revokingKeyId: string | null;
  deletingKeyId: string | null;
  newKeyLabel: string;
  setNewKeyLabel: (v: string) => void;
  revealableKeyId: string | null;
  newApiKeyValue: string | null;
  copiedNewApiKey: boolean;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  loginError: string | null;
  loggingIn: boolean;

  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
  handleRefresh: () => Promise<void>;
  handleRetry: (jobId: string) => Promise<EnqueueJobResponse | null>;
  handleCancel: (jobId: string) => Promise<void>;
  handleCreateJob: (
    url: string,
    strategy: string,
    workerId?: string,
    options?: ScrapeJobOptions,
  ) => Promise<EnqueueJobResponse | null>;
  handleCreateApiKey: () => Promise<void>;
  handleRevokeApiKey: (keyId: string) => Promise<void>;
  handleDeleteApiKey: (keyId: string) => Promise<void>;
  handleCopyNewApiKey: () => Promise<void>;
  handleDismissNewApiKey: () => void;
}

const DashboardSessionContext = createContext<DashboardSessionValue | null>(
  null,
);

export function useDashboardSession() {
  const ctx = useContext(DashboardSessionContext);
  if (!ctx)
    throw new Error(
      "useDashboardSession must be used within DashboardSessionProvider",
    );
  return ctx;
}

export function DashboardSessionProvider({
  children,
  apiBaseUrl,
}: {
  children: React.ReactNode;
  apiBaseUrl: string;
}) {
  const [admin, setAdmin] = useState<AuthenticatedAdmin | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [overview, setOverview] = useState<JobsOverviewSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [newKeyLabel, setNewKeyLabel] = useState("Default scraper client");
  const [revealableKeyId, setRevealableKeyId] = useState<string | null>(null);
  const [newApiKeyValue, setNewApiKeyValue] = useState<string | null>(null);
  const [copiedNewApiKey, setCopiedNewApiKey] = useState(false);

  const loadOverview = useCallback(async () => {
    const snapshot = await fetchJson<JobsOverviewSnapshot>(
      `${apiBaseUrl}/jobs/overview`,
    );
    if (snapshot) {
      startTransition(() => setOverview(snapshot));
    }
  }, [apiBaseUrl]);

  const loadApiKeys = useCallback(async () => {
    setLoadingApiKeys(true);
    const keys = await fetchJson<ApiKeyRecord[]>(
      `${apiBaseUrl}/admin/api-keys`,
    );
    setApiKeys(keys ?? []);
    setLoadingApiKeys(false);
  }, [apiBaseUrl]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      setAuthLoading(true);
      const me = await fetchJson<{ admin: AuthenticatedAdmin }>(
        `${apiBaseUrl}/auth/me`,
      );
      if (cancelled) return;
      if (me?.admin) {
        setAdmin(me.admin);
        await Promise.all([loadOverview(), loadApiKeys()]);
      }
      setAuthLoading(false);
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, loadApiKeys, loadOverview]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(NEW_API_KEY_SESSION_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as SessionApiKeyReveal;
      setRevealableKeyId(parsed.keyId);
      setNewApiKeyValue(parsed.apiKey);
    } catch {
      window.sessionStorage.removeItem(NEW_API_KEY_SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (!admin) return;
    const interval = setInterval(() => {
      setRefreshing(true);
      loadOverview().then(() => setRefreshing(false));
    }, 10_000);
    return () => clearInterval(interval);
  }, [admin, loadOverview]);

  const handleLogin = async () => {
    setLoggingIn(true);
    setLoginError(null);
    const res = await fetchJson<{ admin: AuthenticatedAdmin }>(
      `${apiBaseUrl}/auth/login`,
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    if (!res?.admin) {
      setLoginError("Invalid admin email or password.");
      toast.error("Invalid credentials");
      setLoggingIn(false);
      return;
    }
    setAdmin(res.admin);
    setPassword("");
    await Promise.all([loadOverview(), loadApiKeys()]);
    setLoggingIn(false);
    toast.success("Signed in successfully");
  };

  const handleLogout = async () => {
    await fetchJson(`${apiBaseUrl}/auth/logout`, { method: "POST" });
    window.sessionStorage.removeItem(NEW_API_KEY_SESSION_KEY);
    setAdmin(null);
    setOverview(null);
    setApiKeys([]);
    setRevealableKeyId(null);
    setNewApiKeyValue(null);
    setCopiedNewApiKey(false);
    toast.success("Signed out");
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadOverview(), loadApiKeys()]);
    setRefreshing(false);
  };

  const handleRetry = async (jobId: string) => {
    const retried = await fetchJson<EnqueueJobResponse>(
      `${apiBaseUrl}/jobs/${jobId}/retry`,
      { method: "POST" },
    );
    if (retried) {
      await loadOverview();
      toast.success("Job queued for retry");
    } else {
      toast.error("Retry failed");
    }
    return retried;
  };

  const handleCancel = async (jobId: string) => {
    await fetchJson<ScrapeJobRecord>(`${apiBaseUrl}/jobs/${jobId}/cancel`, {
      method: "POST",
    });
    await loadOverview();
    toast.success("Job cancelled");
  };

  const handleCreateJob = async (
    url: string,
    strategy: string,
    workerId?: string,
    options?: ScrapeJobOptions,
  ) => {
    const payload = {
      url: url.trim(),
      strategy,
      ...(workerId ? { targetWorkerId: workerId } : {}),
      ...(options && Object.keys(options).length > 0 ? { options } : {}),
    };
    const created = await fetchJson<EnqueueJobResponse>(`${apiBaseUrl}/jobs`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (created) {
      await loadOverview();
      toast.success("Job dispatched successfully");
    } else {
      toast.error("Failed to dispatch job");
    }
    return created;
  };

  const handleCreateApiKey = async () => {
    setCreatingApiKey(true);
    const created = await fetchJson<CreateApiKeyResponse>(
      `${apiBaseUrl}/admin/api-keys`,
      {
        method: "POST",
        body: JSON.stringify({ label: newKeyLabel }),
      },
    );
    if (created) {
      setRevealableKeyId(created.record.keyId);
      setNewApiKeyValue(created.apiKey);
      setCopiedNewApiKey(false);
      window.sessionStorage.setItem(
        NEW_API_KEY_SESSION_KEY,
        JSON.stringify({
          keyId: created.record.keyId,
          apiKey: created.apiKey,
        } satisfies SessionApiKeyReveal),
      );
      await loadApiKeys();
      toast.success("API key created");
    } else {
      toast.error("Failed to create API key");
    }
    setCreatingApiKey(false);
  };

  const handleRevokeApiKey = async (keyId: string) => {
    setRevokingKeyId(keyId);
    await fetchJson(`${apiBaseUrl}/admin/api-keys/${keyId}/revoke`, {
      method: "POST",
    });
    await loadApiKeys();
    setRevokingKeyId(null);
    toast.success("API key revoked");
  };

  const handleDeleteApiKey = async (keyId: string) => {
    const confirmed = window.confirm("Delete this API key permanently?");
    if (!confirmed) return;
    setDeletingKeyId(keyId);
    await fetchJson(`${apiBaseUrl}/admin/api-keys/${keyId}`, {
      method: "DELETE",
    });
    await loadApiKeys();
    setDeletingKeyId(null);
    toast.success("API key deleted");
  };

  const handleCopyNewApiKey = async () => {
    if (!newApiKeyValue) return;
    try {
      await navigator.clipboard.writeText(newApiKeyValue);
      setCopiedNewApiKey(true);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDismissNewApiKey = () => {
    window.sessionStorage.removeItem(NEW_API_KEY_SESSION_KEY);
    setRevealableKeyId(null);
    setNewApiKeyValue(null);
    setCopiedNewApiKey(false);
  };

  return (
    <DashboardSessionContext.Provider
      value={{
        apiBaseUrl,
        admin,
        authLoading,
        overview,
        refreshing,
        apiKeys,
        loadingApiKeys,
        creatingApiKey,
        revokingKeyId,
        deletingKeyId,
        newKeyLabel,
        setNewKeyLabel,
        revealableKeyId,
        newApiKeyValue,
        copiedNewApiKey,
        email,
        setEmail,
        password,
        setPassword,
        loginError,
        loggingIn,
        handleLogin,
        handleLogout,
        handleRefresh,
        handleRetry,
        handleCancel,
        handleCreateJob,
        handleCreateApiKey,
        handleRevokeApiKey,
        handleDeleteApiKey,
        handleCopyNewApiKey,
        handleDismissNewApiKey,
      }}
    >
      {children}
    </DashboardSessionContext.Provider>
  );
}
