import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { SessionOrApiKeyGuard } from '../auth/guards/session-or-api-key.guard';
import { JobsService } from './jobs.service';
import { CreateJobDtoSchema } from './dto/create-job.dto';
import type { CreateJobDto } from './dto/create-job.dto';
import { ZodBody } from '../common/decorators';
import type { JobsOverviewTimeSeriesTimeframe } from '@repo/queue-contracts';

const DEFAULT_OVERVIEW_RECENT_LIMIT = 100;
const MAX_OVERVIEW_RECENT_LIMIT = 500;
const DEFAULT_TIME_SERIES_TIMEFRAME: JobsOverviewTimeSeriesTimeframe = 'day';

const TimeSeriesQuerySchema = z.object({
  timeframe: z
    .enum(['hour', '12h', 'day'])
    .default(DEFAULT_TIME_SERIES_TIMEFRAME)
    .describe('Time granularity for buckets'),
  lookbackBuckets: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const num = typeof val === 'string' ? Number.parseInt(val, 10) : val;
      return Number.isFinite(num) && num > 0 && num <= 120 ? num : undefined;
    })
    .describe('Number of buckets to lookback (1-120)'),
});

type TimeSeriesQuery = z.infer<typeof TimeSeriesQuerySchema>;

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
  list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const parsedPage = page ? Number.parseInt(page, 10) : undefined;
    const parsedPageSize = pageSize ? Number.parseInt(pageSize, 10) : undefined;
    return this.jobsService.getPaginatedJobs(parsedPage, parsedPageSize);
  }

  @Get('overview')
  @UseGuards(SessionAuthGuard)
  overview(@Query('recentLimit') recentLimit?: string) {
    const parsedRecentLimit = recentLimit
      ? Number.parseInt(recentLimit, 10)
      : DEFAULT_OVERVIEW_RECENT_LIMIT;
    const safeRecentLimit = Number.isFinite(parsedRecentLimit)
      ? Math.min(
          MAX_OVERVIEW_RECENT_LIMIT,
          Math.max(1, Math.floor(parsedRecentLimit)),
        )
      : DEFAULT_OVERVIEW_RECENT_LIMIT;
    return this.jobsService.getOverviewSnapshot(safeRecentLimit);
  }

  @Get('overview/time-series')
  @UseGuards(SessionAuthGuard)
  overviewTimeSeries(@Query() query: Record<string, string | undefined>) {
    const validation = TimeSeriesQuerySchema.safeParse({
      timeframe: query.timeframe,
      lookbackBuckets: query.lookbackBuckets,
    });

    if (!validation.success) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: validation.error.flatten(),
      });
    }

    const { timeframe, lookbackBuckets } = validation.data;

    return this.jobsService.getOverviewTimeSeries(timeframe, lookbackBuckets);
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
