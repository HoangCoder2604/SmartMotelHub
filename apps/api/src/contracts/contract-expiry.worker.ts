import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { ContractsService } from "./contracts.service.js";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const MIN_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class ContractExpiryWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ContractExpiryWorker.name);
  private interval?: ReturnType<typeof setInterval>;
  private startupTimer?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor(private readonly contractsService: ContractsService) {}

  onApplicationBootstrap() {
    const configured = Number(process.env.CONTRACT_EXPIRY_CHECK_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
    const intervalMs = Number.isFinite(configured) ? Math.max(configured, MIN_INTERVAL_MS) : DEFAULT_INTERVAL_MS;

    this.startupTimer = setTimeout(() => void this.run(), 3000);
    this.startupTimer.unref?.();

    this.interval = setInterval(() => void this.run(), intervalMs);
    this.interval.unref?.();
  }

  onModuleDestroy() {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    if (this.interval) clearInterval(this.interval);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.contractsService.processExpiryWorkflow();
      this.logger.log(
        `Contract expiry workflow: checked=${result.checked}, reminders=${result.reminders}, expired=${result.expired}, date=${result.date}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Contract expiry workflow failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
