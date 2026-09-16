import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const logger = new Logger("Bootstrap");

function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;

  const required = [
    "DATABASE_URL",
    "WEB_ORIGIN",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_STORAGE_BUCKET",
    "VNPAY_TMN_CODE",
    "VNPAY_HASH_SECRET",
    "VNPAY_PAYMENT_URL",
    "VNPAY_RETURN_URL",
    "VNPAY_WEB_RESULT_URL",
  ];

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
}

async function bootstrap() {
  validateProductionEnvironment();

  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === "production" ? ["error", "warn", "log"] : ["error", "warn", "log", "debug"],
  });

  const express = app.getHttpAdapter().getInstance() as { set?: (key: string, value: unknown) => void };
  express.set?.("trust proxy", 1);

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use((_request: unknown, response: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    if (process.env.NODE_ENV === "production") {
      response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3001")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  app.enableCors({
  credentials: true,

  origin(
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) {
    // Không có Origin: cho phép server-to-server callback như VNPAY IPN.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/$/, "");

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(
      new Error("Origin is not allowed by SmartMotel Hub CORS policy"),
      false,
    );
  },

  methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  logger.log(`SmartMotel API listening on port ${port} with prefix /api/v1`);
}

void bootstrap();
