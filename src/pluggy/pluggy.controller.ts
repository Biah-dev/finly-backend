import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthTokenPayload } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CreateItemDto } from './dto/create-item.dto.js';
import { PluggySyncService } from './pluggy-sync.service.js';
import { PluggyService } from './pluggy.service.js';

@Controller('pluggy')
@UseGuards(AuthGuard)
export class PluggyController {
  private readonly logger = new Logger(PluggyController.name);

  constructor(
    private readonly pluggyService: PluggyService,
    private readonly pluggySyncService: PluggySyncService,
  ) {}

  @Post('connect-token')
  async createConnectToken(@CurrentUser() payload: AuthTokenPayload) {
    const connectToken = await this.pluggyService.createConnectToken(
      payload.sub,
    );
    return { connectToken };
  }

  @Get('items')
  listItems(@CurrentUser() payload: AuthTokenPayload) {
    return this.pluggyService.listConnections(payload.sub);
  }

  @Post('items')
  async addItem(
    @CurrentUser() payload: AuthTokenPayload,
    @Body() dto: CreateItemDto,
  ) {
    const connection = await this.pluggyService.saveConnection(
      payload.sub,
      dto.itemId,
    );

    try {
      await this.pluggySyncService.syncConnection(connection.id);
    } catch (err) {
      this.logger.warn(
        `Initial transaction sync failed for connection ${connection.id}: ${(err as Error).message}`,
      );
    }

    return connection;
  }

  @Delete('items/:id')
  async removeItem(
    @CurrentUser() payload: AuthTokenPayload,
    @Param('id') id: string,
  ) {
    await this.pluggyService.removeConnection(payload.sub, id);
    return { success: true };
  }

  @Post('sync')
  syncAll(@CurrentUser() payload: AuthTokenPayload) {
    return this.pluggySyncService.syncUserConnections(payload.sub);
  }

  @Post('items/:id/sync')
  syncItem(@CurrentUser() payload: AuthTokenPayload, @Param('id') id: string) {
    return this.pluggySyncService.syncConnectionForUser(payload.sub, id);
  }
}
