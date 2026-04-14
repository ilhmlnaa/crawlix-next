import { z } from 'zod';

export const LoginDtoSchema = z
  .object({
    email: z.email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  })
  .strict();

export type LoginDto = z.infer<typeof LoginDtoSchema>;
