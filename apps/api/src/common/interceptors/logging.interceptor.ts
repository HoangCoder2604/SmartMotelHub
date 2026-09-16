import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, catchError, finalize, throwError } from "rxjs";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method?: string; originalUrl?: string; url?: string }>();
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();
    const method = request.method ?? "UNKNOWN";
    const url = request.originalUrl ?? request.url ?? "unknown";
    const startedAt = Date.now();

    return next.handle().pipe(
      catchError((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`${method} ${url} failed: ${message}`);
        return throwError(() => error);
      }),
      finalize(() => {
        const duration = Date.now() - startedAt;
        const status = response.statusCode ?? 0;
        const log = `${method} ${url} ${status} ${duration}ms`;
        if (duration >= 1500) this.logger.warn(`SLOW ${log}`);
        else if (process.env.NODE_ENV !== "production") this.logger.log(log);
      }),
    );
  }
}
