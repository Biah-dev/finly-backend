import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateBillingCycleDay(
    userId: string,
    accountId: string,
    billingCycleDay: number,
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      include: { bankConnection: { select: { userId: true } } },
    });

    if (!account || account.bankConnection.userId !== userId) {
      throw new NotFoundException('Account not found.');
    }

    return this.prisma.account.update({
      where: { id: accountId },
      data: { billingCycleDay },
    });
  }
}
