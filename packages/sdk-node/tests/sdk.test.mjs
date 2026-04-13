import test from "node:test";
import assert from "node:assert/strict";

const distModuleUrl = new URL("../dist/index.js", import.meta.url);

test("client builds request with baseUrl and x-api-key", async () => {
  const { CrawlixClient } = await import(distModuleUrl);
  const calls = [];

  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({
        jobId: "job_1",
        status: "queued",
        progress: 0,
        stage: "queued",
        queuedAt: "2026-01-01T00:00:00.000Z",
        resultTtlSeconds: 3600,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const client = new CrawlixClient({
    baseUrl: "https://api.example.com/",
    apiKey: "cx_test",
  });

  await client.createJob({ url: "https://example.com" });

  assert.equal(calls[0].url, "https://api.example.com/api/jobs");
  assert.equal(calls[0].init.headers["x-api-key"], "cx_test");
});

test("client keeps backward compatibility when baseUrl already includes /api", async () => {
  const { CrawlixClient } = await import(distModuleUrl);
  const calls = [];

  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(
      JSON.stringify({
        jobId: "job_api_suffix",
        status: "queued",
        progress: 0,
        stage: "queued",
        queuedAt: "2026-01-01T00:00:00.000Z",
        resultTtlSeconds: 3600,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const client = new CrawlixClient({
    baseUrl: "https://api.example.com/api/",
    apiKey: "cx_test",
  });

  await client.createJob({ url: "https://example.com" });

  assert.equal(calls[0].url, "https://api.example.com/api/jobs");
});

test("client sends idempotency header when provided", async () => {
  const { CrawlixClient } = await import(distModuleUrl);
  let recordedHeaders = null;

  globalThis.fetch = async (_url, init) => {
    recordedHeaders = init.headers;
    return new Response(
      JSON.stringify({
        jobId: "job_2",
        status: "queued",
        progress: 0,
        stage: "queued",
        queuedAt: "2026-01-01T00:00:00.000Z",
        resultTtlSeconds: 3600,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const client = new CrawlixClient({
    baseUrl: "https://api.example.com",
    apiKey: "cx_test",
  });

  await client.createJob({
    url: "https://example.com",
    idempotencyKey: "request-123",
  });

  assert.equal(recordedHeaders["Idempotency-Key"], "request-123");
});

test("waitForCompletion stops on terminal status", async () => {
  const { CrawlixClient } = await import(distModuleUrl);
  const responses = [
    {
      jobId: "job_3",
      status: "processing",
      progress: 40,
      stage: "rendering",
      url: "https://example.com",
      strategy: "auto",
      requestedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:01.000Z",
      fingerprint: "abc",
      options: {},
    },
    {
      jobId: "job_3",
      status: "completed",
      progress: 100,
      stage: "completed",
      url: "https://example.com",
      strategy: "auto",
      requestedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:03.000Z",
      fingerprint: "abc",
      options: {},
    },
  ];

  globalThis.fetch = async () =>
    new Response(JSON.stringify(responses.shift()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const client = new CrawlixClient({
    baseUrl: "https://api.example.com",
    apiKey: "cx_test",
  });

  const result = await client.waitForCompletion("job_3", { intervalMs: 1 });
  assert.equal(result.status, "completed");
});

test("waitForCompletion can fetch final result on completion", async () => {
  const { CrawlixClient } = await import(distModuleUrl);
  let requestCount = 0;

  globalThis.fetch = async (url) => {
    requestCount += 1;
    if (String(url).endsWith("/result")) {
      return new Response(
        JSON.stringify({
          jobId: "job_4",
          status: "completed",
          progress: 100,
          stage: "completed",
          url: "https://example.com",
          strategy: "auto",
          requestedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:00:04.000Z",
          preview: "ok",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        jobId: "job_4",
        status: "completed",
        progress: 100,
        stage: "completed",
        url: "https://example.com",
        strategy: "auto",
        requestedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:04.000Z",
        fingerprint: "abc",
        options: {},
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const client = new CrawlixClient({
    baseUrl: "https://api.example.com",
    apiKey: "cx_test",
  });

  const result = await client.waitForCompletion("job_4", {
    intervalMs: 1,
    fetchResultOnCompleted: true,
  });

  assert.equal(result.preview, "ok");
  assert.equal(requestCount, 2);
});

test("waitForCompletion times out", async () => {
  const {
    CrawlixClient,
    CrawlixPollingTimeoutError,
  } = await import(distModuleUrl);

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        jobId: "job_5",
        status: "processing",
        progress: 10,
        stage: "fetching",
        url: "https://example.com",
        strategy: "auto",
        requestedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:01.000Z",
        fingerprint: "abc",
        options: {},
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const client = new CrawlixClient({
    baseUrl: "https://api.example.com",
    apiKey: "cx_test",
  });

  await assert.rejects(
    () =>
      client.waitForCompletion("job_5", {
        intervalMs: 1,
        timeoutMs: 5,
      }),
    CrawlixPollingTimeoutError,
  );
});

test("webhook signature verification works", async () => {
  const {
    createWebhookSignature,
    verifyWebhookSignature,
  } = await import(distModuleUrl);

  const rawBody = JSON.stringify({
    event: "job.completed",
    data: { jobId: "job_6", status: "completed" },
  });
  const secret = "super-secret";
  const timestamp = "2026-01-01T00:00:00.000Z";
  const signature = createWebhookSignature(secret, timestamp, rawBody);

  assert.equal(
    verifyWebhookSignature({
      secret,
      timestamp,
      rawBody,
      signature,
    }),
    true,
  );

  assert.equal(
    verifyWebhookSignature({
      secret,
      timestamp,
      rawBody,
      signature: "invalid",
    }),
    false,
  );
});
