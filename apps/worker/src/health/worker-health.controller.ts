import { Controller, Get } from '@nestjs/common';
import { WorkerHealthService } from './worker-health.service';

@Controller('worker/health')
export class WorkerHealthController {
  constructor(private readonly workerHealthService: WorkerHealthService) {}

  @Get('live')
  live() {
    return this.workerHealthService.live();
  }

  @Get('ready')
  ready() {
    return this.workerHealthService.ready();
  }
}
