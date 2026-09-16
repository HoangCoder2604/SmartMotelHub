import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";

type Bucket = { count: number; resetAt: number };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private cleanupCounter = 0;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      ip?: string;
      method?: string;
      originalUrl?: string;
      url?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const now = Date.now();
    const path = request.originalUrl ?? request.url ?? "unknown";
    const method = request.method ?? "GET";
    const ip = this.clientIp(request);
    const { limit, windowMs } = this.policy(method, path);
    const key = `${ip}:${method}:${this.routeGroup(path)}`;

    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      this.cleanup(now);
      return true;
    }

    if (current.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      throw new HttpException(
        { statusCode: 429, message: `Quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfter} giây.`, error: "Too Many Requests" },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    this.cleanup(now);
    return true;
  }

  private policy(method: string, path: string) {
    if (/\/auth\/(bootstrap|sync-verification)/.test(path)) return { limit: 25, windowMs: 60_000 };
    if (/\/payments\/.*\/vnpay/.test(path)) return { limit: 30, windowMs: 60_000 };
    if (/\/landlord\/listings\/.*\/images/.test(path)) return { limit: 30, windowMs: 60_000 };
    if (method === "GET") return { limit: 240, windowMs: 60_000 };
    return { limit: 120, windowMs: 60_000 };
  }

  private routeGroup(path: string) {
    return path
      .split("?")[0]
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
      .replace(/\/+/g, "/");
  }

  private clientIp(request: { ip?: string; headers?: Record<string, string | string[] | undefined> }) {
    const forwarded = request.headers?.["x-forwarded-for"];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
    return (first?.trim() || request.ip || "unknown").slice(0, 80);
  }

  private cleanup(now: number) {
    this.cleanupCounter += 1;
    if (this.cleanupCounter % 200 !== 0) return;
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
