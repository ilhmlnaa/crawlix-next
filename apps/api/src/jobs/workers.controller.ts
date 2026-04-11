import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { JobsService } from './jobs.service';

@Controller('workers')
@UseGuards(SessionAuthGuard)
export class WorkersController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  list() {
    return this.jobsService.listWorkers();
  }
}
