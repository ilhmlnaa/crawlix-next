export function createWorkerBootstrapMessage(
  serviceName: string,
  port: string,
): string {
  return `[${serviceName}] bootstrap ready on port ${port}`;
}

export function createLogLine(scope: string, message: string): string {
  return `[${scope}] ${message}`;
}
