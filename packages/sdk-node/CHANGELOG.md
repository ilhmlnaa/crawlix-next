# Changelog

## 1.0.5

- Added `targetWorkerHostname` to job creation input and public job/result payload types
- Included hostname in SDK idempotency key generation so hostname-targeted jobs stay stable
- Updated SDK README with worker-hostname targeting example
- Added Node type definitions to the SDK package config so the build recognizes `node:crypto`

## 1.0.4

- Fixed intermittent race condition where `waitForCompletion(..., { fetchResultOnCompleted: true })` could observe `status: completed` while `/jobs/:id/result` was still temporarily `null`
- Added internal retry logic in SDK polling to wait for a non-null terminal result within the same timeout window
- Added regression test for temporary `null` result response before successful completion payload

## 1.0.3

- Renamed `createAndWaitFast` to `createAndWaitAdaptive` before public adoption
- Kept adaptive polling, metrics, and auto idempotency key generation features

## 1.0.2

- Added optional adaptive polling mode via `waitForCompletion(..., { pollingMode: 'adaptive' })`
- Added `createAndWaitAdaptive` helper with low-latency defaults and polling metrics
- Added optional auto idempotency key generation for `createJob` and `createAndWaitAdaptive`
- Kept backward compatibility: existing `createJob`, `waitForCompletion`, and `createAndWait` behavior remains unchanged by default

## 1.0.1

- Allowed SDK `baseUrl` to use the deployment origin without requiring a manual `/api` suffix
- Kept backward compatibility for base URLs that already end with `/api`
- Updated SDK tests, package README, and Fumadocs examples to reflect the simplified base URL setup

## 1.0.0

- Initial release of the Crawlix Next Node.js SDK
- Added typed `CrawlixClient` for API key based public integrations
- Added `createJob`, `getJob`, `getJobResult`, `waitForCompletion`, and `createAndWait`
- Added webhook signature verification helpers
- Added TypeScript-first public types for jobs, results, and webhook payloads
