import { Body } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

export const ZodBody = (schema: ZodType): ParameterDecorator =>
  Body(new ZodValidationPipe(schema));
