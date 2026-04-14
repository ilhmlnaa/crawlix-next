import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { SessionOrApiKeyGuard } from '../auth/guards/session-or-api-key.guard';
import { JobsService } from './jobs.service';
import { CreateJobDtoSchema } from './dto/create-job.dto';
import type { CreateJobDto } from './dto/create-job.dto';
import { ZodBody } from '../common/decorators';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @UseGuards(SessionOrApiKeyGuard)
  enqueue(
    @ZodBody(CreateJobDtoSchema) body: CreateJobDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.jobsService.enqueue({
      ...body,
      idempotencyKey: body.idempotencyKey ?? idempotencyKey,
    });
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
