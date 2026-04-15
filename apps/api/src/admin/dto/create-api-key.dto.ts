import { z } from 'zod';

export const CreateApiKeyDtoSchema = z
  .object({
    label: z
      .string()
      .min(3, 'Label must be at least 3 characters')
      .max(50, 'Label must be at most 50 characters'),
    rateLimit: z
      .number()
      .positive('Rate limit must be a positive number')
      .optional()
      .nullable(),
  })
  .strict();

export type CreateApiKeyDto = z.infer<typeof CreateApiKeyDtoSchema>;
