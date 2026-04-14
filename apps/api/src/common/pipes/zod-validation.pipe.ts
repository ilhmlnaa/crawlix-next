import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import type { ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body') {
      return value;
    }

    const result = this.schema.safeParse(value);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      }));

      throw new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    }

    return result.data;
  }
}
