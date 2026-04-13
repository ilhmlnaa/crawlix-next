# Changelog

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
