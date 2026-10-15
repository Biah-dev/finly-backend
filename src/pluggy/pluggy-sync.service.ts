import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { PluggyService } from './pluggy.service.js';

// Re-check a few days before the last sync in case a PENDING transaction
// settled to POSTED (or was amended) after we already recorded it.
const OVERLAP_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export interface SyncResult {
  accounts: number;
  transactions: number;
}

@Injectable()
export class PluggySyncService {
  private readonly logger = new Logger(PluggySyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pluggyService: PluggyService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledSync() {
    this.logger.log('Starting scheduled Pluggy sync for all connections.');
    await this.syncAllConnections();
  }

  async syncAllConnections(): Promise<void> {
    const connections = await this.prisma.bankConnection.findMany({
      select: { id: true },
    });

    for (const connection of connections) {
      try {
        await this.syncConnection(connection.id);
      } catch (err) {
        this.logger.warn(
          `Failed to sync bank connection ${connection.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  async syncUserConnections(userId: string): Promise<SyncResult> {
    const connections = await this.prisma.bankConnection.findMany({
      where: { userId },
      select: { id: true },
    });

    const total: SyncResult = { accounts: 0, transactions: 0 };
    for (const connection of connections) {
      const result = await this.syncConnection(connection.id);
      total.accounts += result.accounts;
      total.transactions += result.transactions;
    }
    return total;
  }

  async syncConnectionForUser(
    userId: string,
    connectionId: string,
  ): Promise<SyncResult> {
    const connection = await this.prisma.bankConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.userId !== userId) {
      throw new NotFoundException('Bank connection not found.');
    }

    return this.syncConnection(connectionId);
  }

  async syncConnection(connectionId: string): Promise<SyncResult> {
    const connection = await this.prisma.bankConnection.findUniqueOrThrow({
      where: { id: connectionId },
    });

    const from = connection.lastSyncedAt
      ? new Date(connection.lastSyncedAt.getTime() - OVERLAP_WINDOW_MS)
      : undefined;

    const remoteAccounts = await this.pluggyService.fetchAccounts(
      connection.pluggyItemId,
    );
    let transactionCount = 0;

    for (const remoteAccount of remoteAccounts) {
      const account = await this.prisma.account.upsert({
        where: { pluggyAccountId: remoteAccount.id },
        create: {
          bankConnectionId: connection.id,
          pluggyAccountId: remoteAccount.id,
          type: remoteAccount.type,
          subtype: remoteAccount.subtype,
          name: remoteAccount.name,
          number: remoteAccount.number,
          currencyCode: remoteAccount.currencyCode,
          balance: remoteAccount.balance,
        },
        update: {
          type: remoteAccount.type,
          subtype: remoteAccount.subtype,
          name: remoteAccount.name,
          number: remoteAccount.number,
          currencyCode: remoteAccount.currencyCode,
          balance: remoteAccount.balance,
        },
      });

      const remoteTransactions = await this.pluggyService.fetchTransactions(
        remoteAccount.id,
        from,
      );

      for (const remoteTransaction of remoteTransactions) {
        await this.prisma.transaction.upsert({
          where: { pluggyTransactionId: remoteTransaction.id },
          create: {
            accountId: account.id,
            pluggyTransactionId: remoteTransaction.id,
            description: remoteTransaction.description,
            amount: remoteTransaction.amount,
            currencyCode: remoteTransaction.currencyCode,
            date: new Date(remoteTransaction.date),
            category: remoteTransaction.category,
            categoryId: remoteTransaction.categoryId,
            type: remoteTransaction.type,
            status: remoteTransaction.status,
            balance: remoteTransaction.balance,
          },
          update: {
            description: remoteTransaction.description,
            amount: remoteTransaction.amount,
            category: remoteTransaction.category,
            categoryId: remoteTransaction.categoryId,
            status: remoteTransaction.status,
            balance: remoteTransaction.balance,
          },
        });
      }

      transactionCount += remoteTransactions.length;
    }

    await this.prisma.bankConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date() },
    });

    return { accounts: remoteAccounts.length, transactions: transactionCount };
  }
}
