import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { billPeriodEnd, billPeriodStart } from './billing-period.util.js';
import type { AccountTypeFilter } from './dto/list-transactions-query.dto.js';

export interface ListTransactionsOptions {
  page: number;
  pageSize: number;
  accountType?: AccountTypeFilter;
}

export interface SerializedTransaction {
  id: string;
  description: string;
  amount: number;
  currencyCode: string;
  date: Date;
  category: string | null;
  type: string;
  status: string;
  accountName: string;
  accountType: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(
    userId: string,
    { page, pageSize, accountType }: ListTransactionsOptions,
  ) {
    const where = {
      account: {
        bankConnection: { userId },
        ...(accountType ? { type: accountType } : {}),
      },
    };

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          account: {
            select: {
              name: true,
              type: true,
              bankConnection: {
                select: { connectorName: true, connectorImageUrl: true },
              },
            },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        description: transaction.description,
        amount: transaction.amount.toNumber(),
        currencyCode: transaction.currencyCode,
        date: transaction.date,
        category: transaction.category,
        type: transaction.type,
        status: transaction.status,
        accountName: transaction.account.name,
        accountType: transaction.account.type,
        connectorName: transaction.account.bankConnection.connectorName,
        connectorImageUrl: transaction.account.bankConnection.connectorImageUrl,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async listCreditCardBills(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { type: 'CREDIT', bankConnection: { userId } },
      include: {
        bankConnection: {
          select: { connectorName: true, connectorImageUrl: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = [];

    for (const account of accounts) {
      const transactions = await this.prisma.transaction.findMany({
        where: { accountId: account.id },
        orderBy: { date: 'desc' },
      });

      const bills = new Map<
        string,
        {
          periodStart: Date;
          periodEnd: Date;
          total: number;
          transactions: SerializedTransaction[];
        }
      >();

      if (account.billingCycleDay) {
        for (const transaction of transactions) {
          const periodEnd = billPeriodEnd(
            transaction.date,
            account.billingCycleDay,
          );
          const key = periodEnd.toISOString().slice(0, 10);

          let bill = bills.get(key);
          if (!bill) {
            bill = {
              periodStart: billPeriodStart(periodEnd, account.billingCycleDay),
              periodEnd,
              total: 0,
              transactions: [],
            };
            bills.set(key, bill);
          }

          bill.total += transaction.amount.toNumber();
          bill.transactions.push(
            this.serializeTransaction(transaction, account),
          );
        }
      }

      result.push({
        accountId: account.id,
        accountName: account.name,
        connectorName: account.bankConnection.connectorName,
        connectorImageUrl: account.bankConnection.connectorImageUrl,
        billingCycleDay: account.billingCycleDay,
        bills: Array.from(bills.values()).sort(
          (a, b) => b.periodEnd.getTime() - a.periodEnd.getTime(),
        ),
      });
    }

    return { accounts: result };
  }

  private serializeTransaction(
    transaction: {
      id: string;
      description: string;
      amount: { toNumber(): number };
      currencyCode: string;
      date: Date;
      category: string | null;
      type: string;
      status: string;
    },
    account: { name: string; type: string },
  ): SerializedTransaction {
    return {
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount.toNumber(),
      currencyCode: transaction.currencyCode,
      date: transaction.date,
      category: transaction.category,
      type: transaction.type,
      status: transaction.status,
      accountName: account.name,
      accountType: account.type,
    };
  }
}
