import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  ScrapeJobOptions,
  ScrapeStrategy,
  ScrapeWaitUntil,
} from '@repo/queue-contracts';

class CreateJobOptionsDto implements ScrapeJobOptions {
  @IsOptional()
  @IsInt()
  @Min(1)
  timeoutMs?: number;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsObject()
  formData?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  useCache?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  cacheTtlSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxRetries?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  retryDelayMs?: number;

  @IsOptional()
  @IsIn(['load', 'domcontentloaded', 'networkidle', 'commit'])
  waitUntil?: ScrapeWaitUntil;

  @IsOptional()
  @IsString()
  waitForSelector?: string;

  @IsOptional()
  @IsString()
  waitForFunction?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  additionalDelayMs?: number;

  @IsOptional()
  @IsBoolean()
  useProxy?: boolean;
}

export class CreateJobDto {
  @IsUrl()
  url!: string;

  @IsOptional()
  @IsIn(['cloudscraper', 'playwright', 'auto'])
  strategy?: ScrapeStrategy;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateJobOptionsDto)
  options?: CreateJobOptionsDto;

  @IsOptional()
  @IsString()
  targetWorkerId?: string;
}
