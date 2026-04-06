import { Logger } from '@nestjs/common';
import type { ApiRuntimeConfig } from '@repo/config';

const logger = new Logger('Bootstrap');

export function logBootstrapSummary(config: ApiRuntimeConfig) {
  logger.log(
    `service=${config.serviceName} port=${config.port} cors=${config.corsOrigin} dashboardOrigin=${config.auth.dashboardOrigin}`,
  );
  logger.log(
    `authCookie=${config.auth.sessionCookieName} sessionTtl=${config.auth.sessionTtlSeconds}s adminEmail=${config.auth.adminEmail}`,
  );
}
