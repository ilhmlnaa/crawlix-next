import { Logger } from '@nestjs/common';

const logger = new Logger('WorkerQueue');

export function logQueueConsumerReady(queueName: string) {
  logger.log(`consuming queue=${queueName}`);
}

export function logJobRetry(
  jobId: string,
  attempt: number,
  maxAttempts: number,
) {
  logger.warn(`job=${jobId} retry scheduled attempt=${attempt}/${maxAttempts}`);
}

export function logJobFailure(
  jobId: string,
  attempt: number,
  errorMessage: string,
) {
  logger.error(
    `job=${jobId} failed permanently attempt=${attempt} error=${errorMessage}`,
  );
}
