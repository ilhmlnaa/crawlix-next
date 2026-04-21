import { z } from 'zod';
import type {
  ScrapeJobOptions,
  ScrapeStrategy,
  ScrapeWaitUntil,
} from '@repo/queue-contracts';

const ScrapeStrategySchema: z.ZodType<ScrapeStrategy> = z.enum([
  'cloudscraper',
  'playwright',
  'auto',
]);

const ScrapeWaitUntilSchema: z.ZodType<ScrapeWaitUntil> = z.enum([
  'load',
  'domcontentloaded',
  'networkidle',
  'commit',
]);

const CreateJobOptionsDtoSchema: z.ZodType<ScrapeJobOptions> = z
  .object({
    timeoutMs: z
      .number()
      .int()
      .min(1, 'Timeout must be at least 1ms')
      .optional(),
    method: z.string().optional(),
    body: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    formData: z.record(z.string(), z.string()).optional(),
    useCache: z.boolean().optional(),
    cacheTtlSeconds: z
      .number()
      .int()
      .min(1, 'Cache TTL must be at least 1 second')
      .optional(),
    maxRetries: z
      .number()
      .int()
      .min(0, 'Max retries must be at least 0')
      .optional(),
    retryDelayMs: z
      .number()
      .int()
      .min(0, 'Retry delay must be at least 0ms')
      .optional(),
    waitUntil: ScrapeWaitUntilSchema.optional(),
    waitForSelector: z.string().optional(),
    waitForFunction: z.string().optional(),
    additionalDelayMs: z
      .number()
      .int()
      .min(0, 'Additional delay must be at least 0ms')
      .optional(),
    useProxy: z.boolean().optional(),
    proxyUrl: z.string().url('Invalid proxy URL').optional(),
  })
  .strict();

export const CreateJobDtoSchema = z
  .object({
    url: z.string().url('Invalid URL'),
    strategy: ScrapeStrategySchema.optional(),
    options: CreateJobOptionsDtoSchema.optional(),
    targetWorkerId: z.string().optional(),
    targetWorkerServiceName: z.string().optional(),
    targetWorkerHostname: z.string().optional(),
    webhookUrl: z.string().url('Invalid webhook URL').optional(),
    webhookSecret: z.string().optional(),
    idempotencyKey: z.string().optional(),
  })
  .strict();

export type CreateJobDto = z.infer<typeof CreateJobDtoSchema>;
