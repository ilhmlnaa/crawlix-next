import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const remoteAddress =
      request.ip ?? request.socket.remoteAddress ?? 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          this.logger.log(
            `${request.method} ${request.originalUrl} -> ${response.statusCode} ${durationMs}ms ip=${remoteAddress}`,
          );
        },
        error: (error: unknown) => {
          const durationMs = Date.now() - startedAt;
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `${request.method} ${request.originalUrl} -> error ${durationMs}ms ip=${remoteAddress} message=${message}`,
          );
        },
      }),
    );
  }
}
