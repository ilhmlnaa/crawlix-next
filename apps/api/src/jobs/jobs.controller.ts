import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { SessionOrApiKeyGuard } from '../auth/guards/session-or-api-key.guard';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @UseGuards(SessionOrApiKeyGuard)
  enqueue(@Body() body: CreateJobDto) {
    return this.jobsService.enqueue(body);
  }

  @Post(':jobId/retry')
  @UseGuards(SessionAuthGuard)
  retry(@Param('jobId') jobId: string) {
    return this.jobsService.retry(jobId);
  }

  @Post(':jobId/cancel')
  @UseGuards(SessionAuthGuard)
  cancel(@Param('jobId') jobId: string) {
    return this.jobsService.cancel(jobId);
  }

  @Get()
  @UseGuards(SessionAuthGuard)
  list() {
    return this.jobsService.getDashboardSnapshot();
  }

  @Get('overview')
  @UseGuards(SessionAuthGuard)
  overview() {
    return this.jobsService.getOverviewSnapshot();
  }

  @Get(':jobId')
  @UseGuards(SessionOrApiKeyGuard)
  getStatus(@Param('jobId') jobId: string) {
    return this.jobsService.getJob(jobId);
  }

  @Get(':jobId/result')
  @UseGuards(SessionOrApiKeyGuard)
  getResult(@Param('jobId') jobId: string) {
    return this.jobsService.getResult(jobId);
  }
}
