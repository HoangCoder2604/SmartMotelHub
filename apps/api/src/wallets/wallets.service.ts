import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole, UserStatus, WithdrawalStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { ApproveWithdrawalDto } from "./dto/approve-withdrawal.dto.js";
import { CreateWithdrawalDto } from "./dto/create-withdrawal.dto.js";
import { RejectWithdrawalDto } from "./dto/reject-withdrawal.dto.js";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto.js";

const withdrawalInclude = {
  landlord: { select: { id: true, fullName: true, email: true, phone: true } },
  reviewedByAdmin: { select: { id: true, fullName: true, email: true } },
};

function clean(value: string | undefined) {
  const result = value?.trim();
  return result ? result : null;
}

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async ensureWallet(landlordId: string) {
    return this.prisma.landlordWallet.upsert({
      where: { landlordId },
      create: { landlordId },
      update: {},
    });
  }

  async landlordOverview(landlordId: string) {
    const wallet = await this.ensureWallet(landlordId);
    const [bankAccount, withdrawals, transactions] = await Promise.all([
      this.prisma.landlordBankAccount.findUnique({ where: { landlordId } }),
      this.prisma.withdrawalRequest.findMany({
        where: { landlordId },
        orderBy: { requestedAt: "desc" },
        take: 20,
        include: { reviewedByAdmin: { select: { fullName: true } } },
      }),
      this.prisma.landlordWalletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          payment: { select: { txnRef: true } },
          withdrawalRequest: { select: { id: true, status: true } },
        },
      }),
    ]);

    const balance = Number(wallet.balance);
    const pendingWithdrawal = Number(wallet.pendingWithdrawal);
    return {
      wallet: {
        ...wallet,
        availableBalance: Math.max(0, balance - pendingWithdrawal),
      },
      bankAccount,
      withdrawals,
      transactions,
    };
  }

  async upsertBankAccount(landlordId: string, dto: UpdateBankAccountDto) {
    const accountNumber = dto.accountNumber.replace(/\s+/g, "").trim();
    if (!/^[0-9A-Za-z.-]{4,50}$/.test(accountNumber)) {
      throw new BadRequestException("Số tài khoản ngân hàng không hợp lệ.");
    }

    return this.prisma.landlordBankAccount.upsert({
      where: { landlordId },
      create: {
        landlordId,
        bankCode: dto.bankCode.trim().toUpperCase(),
        bankName: dto.bankName.trim(),
        accountNumber,
        accountHolderName: dto.accountHolderName.trim().toUpperCase(),
        branch: clean(dto.branch),
      },
      update: {
        bankCode: dto.bankCode.trim().toUpperCase(),
        bankName: dto.bankName.trim(),
        accountNumber,
        accountHolderName: dto.accountHolderName.trim().toUpperCase(),
        branch: clean(dto.branch),
      },
    });
  }

  async createWithdrawal(landlordId: string, dto: CreateWithdrawalDto) {
    const amount = dto.amount;
    const bankAccount = await this.prisma.landlordBankAccount.findUnique({ where: { landlordId } });
    if (!bankAccount) {
      throw new BadRequestException("Hãy thêm tài khoản ngân hàng trước khi tạo yêu cầu rút tiền.");
    }

    try {
      const withdrawal = await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.landlordWallet.upsert({
          where: { landlordId },
          create: { landlordId },
          update: {},
        });

        const available = Number(wallet.balance) - Number(wallet.pendingWithdrawal);
        if (amount > available) {
          throw new BadRequestException(
            `Số dư khả dụng không đủ. Hiện có ${Math.max(0, Math.floor(available)).toLocaleString("vi-VN")} đ.`,
          );
        }

        await tx.landlordWallet.update({
          where: { id: wallet.id },
          data: { pendingWithdrawal: { increment: amount } },
        });

        return tx.withdrawalRequest.create({
          data: {
            landlordId,
            bankAccountId: bankAccount.id,
            amount,
            bankCode: bankAccount.bankCode,
            bankName: bankAccount.bankName,
            accountNumber: bankAccount.accountNumber,
            accountHolderName: bankAccount.accountHolderName,
            branch: bankAccount.branch,
          },
          include: withdrawalInclude,
        });
      }, { isolationLevel: "Serializable" });

      const admins = await this.prisma.user.findMany({
        where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
        select: { id: true },
      });
      await Promise.all(
        admins.map((admin) => this.notifications.notify({
          userId: admin.id,
          type: "WITHDRAWAL_REQUESTED",
          title: "Có yêu cầu rút tiền mới",
          message: `Landlord vừa yêu cầu rút ${Math.round(amount).toLocaleString("vi-VN")} đ.`,
          href: "/admin/payments",
        }).catch(() => undefined)),
      );

      return withdrawal;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw error;
    }
  }

  async listAdminWithdrawals(status?: WithdrawalStatus) {
    const where = status ? { status } : undefined;
    const [withdrawals, pendingCount, pendingAmount] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where,
        orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
        include: withdrawalInclude,
        take: 100,
      }),
      this.prisma.withdrawalRequest.count({ where: { status: WithdrawalStatus.PENDING } }),
      this.prisma.withdrawalRequest.aggregate({
        where: { status: WithdrawalStatus.PENDING },
        _sum: { amount: true },
      }),
    ]);

    return {
      withdrawals,
      summary: {
        pendingCount,
        pendingAmount: Number(pendingAmount._sum.amount ?? 0),
      },
    };
  }

  async approveWithdrawal(adminId: string, id: string, dto: ApproveWithdrawalDto) {
    const current = await this.prisma.withdrawalRequest.findUnique({ where: { id }, include: withdrawalInclude });
    if (!current) throw new NotFoundException("Không tìm thấy yêu cầu rút tiền.");
    if (current.status !== WithdrawalStatus.PENDING) {
      throw new ConflictException("Yêu cầu rút tiền này đã được xử lý.");
    }

    const now = new Date();
    const amount = Number(current.amount);

    const approved = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.withdrawalRequest.updateMany({
        where: { id, status: WithdrawalStatus.PENDING },
        data: {
          status: WithdrawalStatus.APPROVED,
          transferReference: dto.transferReference.trim(),
          adminNote: clean(dto.adminNote),
          rejectionReason: null,
          reviewedByAdminId: adminId,
          reviewedAt: now,
        },
      });
      if (changed.count !== 1) throw new ConflictException("Yêu cầu rút tiền vừa được xử lý ở phiên khác.");

      const wallet = await tx.landlordWallet.findUnique({ where: { landlordId: current.landlordId } });
      if (!wallet) throw new ConflictException("Không tìm thấy ví của chủ trọ.");

      if (Number(wallet.balance) < amount || Number(wallet.pendingWithdrawal) < amount) {
        throw new ConflictException("Số dư ví không còn phù hợp với yêu cầu rút tiền. Cần đối soát trước khi duyệt.");
      }

      await tx.landlordWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amount },
          pendingWithdrawal: { decrement: amount },
          totalWithdrawn: { increment: amount },
        },
      });

      await tx.landlordWalletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "WITHDRAWAL_DEBIT",
          amount,
          withdrawalRequestId: id,
          description: `Withdrawal approved · ${dto.transferReference.trim()}`,
        },
      });

      return tx.withdrawalRequest.findUniqueOrThrow({ where: { id }, include: withdrawalInclude });
    }, { isolationLevel: "Serializable" });

    await this.notifications.notify({
      userId: current.landlordId,
      type: "WITHDRAWAL_APPROVED",
      title: "Yêu cầu rút tiền đã được duyệt",
      message: `${Math.round(amount).toLocaleString("vi-VN")} đ đã được xác nhận chuyển tới ${current.bankName} · ${current.accountNumber}.`,
      href: "/landlord/payments",
    }).catch(() => undefined);

    return approved;
  }

  async rejectWithdrawal(adminId: string, id: string, dto: RejectWithdrawalDto) {
    const current = await this.prisma.withdrawalRequest.findUnique({ where: { id }, include: withdrawalInclude });
    if (!current) throw new NotFoundException("Không tìm thấy yêu cầu rút tiền.");
    if (current.status !== WithdrawalStatus.PENDING) {
      throw new ConflictException("Yêu cầu rút tiền này đã được xử lý.");
    }

    const amount = Number(current.amount);
    const now = new Date();

    const rejected = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.withdrawalRequest.updateMany({
        where: { id, status: WithdrawalStatus.PENDING },
        data: {
          status: WithdrawalStatus.REJECTED,
          rejectionReason: dto.reason.trim(),
          reviewedByAdminId: adminId,
          reviewedAt: now,
        },
      });
      if (changed.count !== 1) throw new ConflictException("Yêu cầu rút tiền vừa được xử lý ở phiên khác.");

      const wallet = await tx.landlordWallet.findUnique({ where: { landlordId: current.landlordId } });
      if (!wallet || Number(wallet.pendingWithdrawal) < amount) {
        throw new ConflictException("Số tiền đang giữ chỗ không hợp lệ. Cần đối soát trước khi từ chối.");
      }

      await tx.landlordWallet.update({
        where: { id: wallet.id },
        data: { pendingWithdrawal: { decrement: amount } },
      });

      return tx.withdrawalRequest.findUniqueOrThrow({ where: { id }, include: withdrawalInclude });
    }, { isolationLevel: "Serializable" });

    await this.notifications.notify({
      userId: current.landlordId,
      type: "WITHDRAWAL_REJECTED",
      title: "Yêu cầu rút tiền bị từ chối",
      message: `Yêu cầu rút ${Math.round(amount).toLocaleString("vi-VN")} đ bị từ chối: ${dto.reason.trim()}`,
      href: "/landlord/payments",
    }).catch(() => undefined);

    return rejected;
  }
}
