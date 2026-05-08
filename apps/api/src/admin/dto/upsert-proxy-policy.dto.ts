import { z } from 'zod';
import type {
  ProxyPolicyMode,
  ProxyPolicyStrategy,
  ProxyScopeType,
} from '@repo/queue-contracts';

const ProxyScopeTypeSchema: z.ZodType<ProxyScopeType> = z.enum([
  'global',
  'workerService',
]);

const ProxyPolicyModeSchema: z.ZodType<ProxyPolicyMode> = z.enum([
  'direct',
  'pool',
]);

const ProxyPolicyStrategySchema: z.ZodType<ProxyPolicyStrategy> = z.enum([
  'round_robin',
]);

export const UpsertProxyPolicyDtoSchema = z
  .object({
    enabled: z.boolean(),
    mode: ProxyPolicyModeSchema,
    proxies: z.array(z.string().url('Invalid proxy URL')).default([]),
    strategy: ProxyPolicyStrategySchema.default('round_robin'),
    scopeType: ProxyScopeTypeSchema,
    scopeKey: z.string().optional(),
  })
  .strict();

export type UpsertProxyPolicyDto = z.infer<typeof UpsertProxyPolicyDtoSchema>;
