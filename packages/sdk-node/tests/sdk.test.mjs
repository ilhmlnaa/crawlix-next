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

test("client can auto-generate idempotency key", async () => {
  const { CrawlixClient } = await import(distModuleUrl);
  let recordedHeaders = null;
  let recordedBody = null;

  globalThis.fetch = async (_url, init) => {
    recordedHeaders = init.headers;
    recordedBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        jobId: "job_auto_idempotency",
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

  await client.createJob(
    {
      url: "https://example.com",
      strategy: "cloudscraper",
      options: {
        timeoutMs: 5000,
        useCache: true,
      },
    },
    {
      autoIdempotencyKey: true,
      idempotencyNamespace: "sdk-fast",
    },
  );

  assert.equal(typeof recordedHeaders["Idempotency-Key"], "string");
  assert.equal(
    recordedHeaders["Idempotency-Key"].startsWith("sdk-fast-"),
    true,
  );
  assert.equal(recordedBody.idempotencyKey, recordedHeaders["Idempotency-Key"]);
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

test("waitForCompletion retries when /result is temporarily null", async () => {
  const { CrawlixClient } = await import(distModuleUrl);
  let resultRequestCount = 0;

  globalThis.fetch = async (url) => {
    const href = String(url);

    if (href.endsWith("/jobs/job_4_race")) {
      return new Response(
        JSON.stringify({
          jobId: "job_4_race",
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
    }

    if (href.endsWith("/jobs/job_4_race/result")) {
      resultRequestCount += 1;
      if (resultRequestCount === 1) {
        return new Response("null", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          jobId: "job_4_race",
          status: "completed",
          progress: 100,
          stage: "completed",
          url: "https://example.com",
          strategy: "auto",
          requestedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:00:05.000Z",
          preview: "ok-after-retry",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    throw new Error(`Unexpected URL: ${href}`);
  };

  const client = new CrawlixClient({
    baseUrl: "https://api.example.com",
    apiKey: "cx_test",
  });

  const result = await client.waitForCompletion("job_4_race", {
    intervalMs: 1,
    timeoutMs: 5000,
    fetchResultOnCompleted: true,
  });

  assert.equal(result.preview, "ok-after-retry");
  assert.equal(resultRequestCount >= 2, true);
});

test("waitForCompletion times out", async () => {
  const { CrawlixClient, CrawlixPollingTimeoutError } = await import(
    distModuleUrl
  );

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

test("createAndWaitAdaptive returns terminal result and metrics", async () => {
  const { CrawlixClient } = await import(distModuleUrl);
  let statusChecks = 0;

  globalThis.fetch = async (url) => {
    const href = String(url);

    if (href.endsWith("/jobs")) {
      return new Response(
        JSON.stringify({
          jobId: "job_fast_1",
          status: "queued",
          progress: 0,
          stage: "queued",
          queuedAt: "2026-01-01T00:00:00.000Z",
          resultTtlSeconds: 3600,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (href.endsWith("/jobs/job_fast_1")) {
      statusChecks += 1;
      const status = statusChecks >= 2 ? "completed" : "processing";

      return new Response(
        JSON.stringify({
          jobId: "job_fast_1",
          status,
          progress: status === "completed" ? 100 : 20,
          stage: status === "completed" ? "completed" : "fetching",
          url: "https://example.com",
          strategy: "cloudscraper",
          requestedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:01.000Z",
          fingerprint: "abc",
          options: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (href.endsWith("/jobs/job_fast_1/result")) {
      return new Response(
        JSON.stringify({
          jobId: "job_fast_1",
          status: "completed",
          progress: 100,
          stage: "completed",
          url: "https://example.com",
          strategy: "cloudscraper",
          requestedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:00:02.000Z",
          preview: "ok",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    throw new Error(`Unexpected URL: ${href}`);
  };

  const client = new CrawlixClient({
    baseUrl: "https://api.example.com",
    apiKey: "cx_test",
  });

  const result = await client.createAndWaitAdaptive(
    {
      url: "https://example.com",
      strategy: "cloudscraper",
    },
    {
      adaptiveIntervals: [{ afterMs: 0, intervalMs: 1 }],
      timeoutMs: 5000,
      autoIdempotencyKey: true,
      idempotencyNamespace: "sdk-fast",
    },
  );

  assert.equal(result.terminal.status, "completed");
  assert.equal(result.metrics.pollCount >= 2, true);
  assert.equal(result.metrics.totalMs >= 0, true);
});

test("webhook signature verification works", async () => {
  const { createWebhookSignature, verifyWebhookSignature } = await import(
    distModuleUrl
  );

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
