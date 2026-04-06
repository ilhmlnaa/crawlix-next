import { Injectable } from '@nestjs/common';
import { getWorkerRuntimeConfig } from '@repo/config';
import { createServiceMetadata } from '@repo/shared';

@Injectable()
export class AppService {
  readonly service = createServiceMetadata('worker');
  readonly config = getWorkerRuntimeConfig();
}
