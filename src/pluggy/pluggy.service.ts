import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

const PLUGGY_API_URL = 'https://api.pluggy.ai';
const API_KEY_TTL_MS = 100 * 60 * 1000;

interface PluggyItemConnector {
  name: string;
  imageUrl: string;
}

interface PluggyItem {
  id: string;
  status: string;
  connector: PluggyItemConnector;
}

export interface PluggyAccount {
  id: string;
  type: string;
  subtype: string | null;
  name: string;
  number: string | null;
  currencyCode: string;
  balance: number;
}

export interface PluggyTransaction {
  id: string;
  description: string;
  currencyCode: string;
  amount: number;
  date: string;
  category: string | null;
  categoryId: string | null;
  type: string;
  status: string;
  balance: number | null;
}

interface PluggyCursorResponse<T> {
  results: T[];
  next: string | null;
}

@Injectable()
export class PluggyService {
  private readonly logger = new Logger(PluggyService.name);
  private cachedApiKey: { key: string; expiresAt: number } | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private async logFetchFailure(context: string, res: Response): Promise<void> {
    const body = await res.text().catch(() => '<unreadable body>');
    this.logger.error(
      `${context} failed: ${res.status} ${res.statusText} - ${body}`,
    );
  }

  private async getApiKey(): Promise<string> {
    if (this.cachedApiKey && this.cachedApiKey.expiresAt > Date.now()) {
      return this.cachedApiKey.key;
    }

    const clientId = this.configService.get<string>('PLUGGY_CLIENT_ID');
    const clientSecret = this.configService.get<string>('PLUGGY_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException(
        'Pluggy is not configured. Set PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET.',
      );
    }

    const res = await fetch(`${PLUGGY_API_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    });

    if (!res.ok) {
      await this.logFetchFailure('Pluggy auth', res);
      throw new BadGatewayException('Could not authenticate with Pluggy.');
    }

    const data = (await res.json()) as { apiKey: string };
    this.cachedApiKey = {
      key: data.apiKey,
      expiresAt: Date.now() + API_KEY_TTL_MS,
    };
    return data.apiKey;
  }

  async createConnectToken(userId: string): Promise<string> {
    const apiKey = await this.getApiKey();

    const res = await fetch(`${PLUGGY_API_URL}/connect_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ options: { clientUserId: userId } }),
    });

    if (!res.ok) {
      await this.logFetchFailure('Pluggy connect token creation', res);
      throw new BadGatewayException('Could not create a Pluggy connect token.');
    }

    const data = (await res.json()) as { accessToken: string };
    return data.accessToken;
  }

  private async fetchItem(itemId: string): Promise<PluggyItem> {
    const apiKey = await this.getApiKey();
    const res = await fetch(`${PLUGGY_API_URL}/items/${itemId}`, {
      headers: { 'X-API-KEY': apiKey },
    });

    if (!res.ok) {
      await this.logFetchFailure(`Pluggy item fetch (${itemId})`, res);
      throw new NotFoundException('Bank connection not found on Pluggy.');
    }

    return res.json() as Promise<PluggyItem>;
  }

  async fetchAccounts(itemId: string): Promise<PluggyAccount[]> {
    const apiKey = await this.getApiKey();
    const res = await fetch(`${PLUGGY_API_URL}/accounts?itemId=${itemId}`, {
      headers: { 'X-API-KEY': apiKey },
    });

    if (!res.ok) {
      await this.logFetchFailure(`Pluggy accounts fetch (item ${itemId})`, res);
      throw new BadGatewayException('Could not fetch accounts from Pluggy.');
    }

    const data = (await res.json()) as { results: PluggyAccount[] };
    return data.results;
  }

  async fetchTransactions(
    accountId: string,
    from?: Date,
  ): Promise<PluggyTransaction[]> {
    const apiKey = await this.getApiKey();
    const transactions: PluggyTransaction[] = [];

    const params = new URLSearchParams({ accountId });
    if (from) {
      params.set('dateFrom', from.toISOString().slice(0, 10));
    }

    let next: string | null = `?${params.toString()}`;

    while (next) {
      const res = await fetch(`${PLUGGY_API_URL}/v2/transactions${next}`, {
        headers: { 'X-API-KEY': apiKey },
      });

      if (!res.ok) {
        await this.logFetchFailure(
          `Pluggy transactions fetch (account ${accountId})`,
          res,
        );
        throw new BadGatewayException(
          'Could not fetch transactions from Pluggy.',
        );
      }

      const data =
        (await res.json()) as PluggyCursorResponse<PluggyTransaction>;
      transactions.push(...data.results);
      next = data.next;
    }

    return transactions;
  }

  listConnections(userId: string) {
    return this.prisma.bankConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveConnection(userId: string, itemId: string) {
    const item = await this.fetchItem(itemId);

    return this.prisma.bankConnection.upsert({
      where: { pluggyItemId: item.id },
      create: {
        userId,
        pluggyItemId: item.id,
        connectorName: item.connector.name,
        connectorImageUrl: item.connector.imageUrl,
        status: item.status,
      },
      update: {
        status: item.status,
        connectorName: item.connector.name,
        connectorImageUrl: item.connector.imageUrl,
      },
    });
  }

  async removeConnection(userId: string, connectionId: string) {
    const connection = await this.prisma.bankConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || connection.userId !== userId) {
      throw new NotFoundException('Bank connection not found.');
    }

    try {
      const apiKey = await this.getApiKey();
      await fetch(`${PLUGGY_API_URL}/items/${connection.pluggyItemId}`, {
        method: 'DELETE',
        headers: { 'X-API-KEY': apiKey },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to delete item ${connection.pluggyItemId} on Pluggy: ${(err as Error).message}`,
      );
    }

    await this.prisma.bankConnection.delete({ where: { id: connectionId } });
  }
}
