import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthTokenPayload } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CreateItemDto } from './dto/create-item.dto.js';
import { PluggyService } from './pluggy.service.js';

@Controller('pluggy')
@UseGuards(AuthGuard)
export class PluggyController {
  constructor(private readonly pluggyService: PluggyService) {}

  @Post('connect-token')
  async createConnectToken(@CurrentUser() payload: AuthTokenPayload) {
    const connectToken = await this.pluggyService.createConnectToken(payload.sub);
    return { connectToken };
  }

  @Get('items')
  listItems(@CurrentUser() payload: AuthTokenPayload) {
    return this.pluggyService.listConnections(payload.sub);
  }

  @Post('items')
  addItem(@CurrentUser() payload: AuthTokenPayload, @Body() dto: CreateItemDto) {
    return this.pluggyService.saveConnection(payload.sub, dto.itemId);
  }

  @Delete('items/:id')
  async removeItem(@CurrentUser() payload: AuthTokenPayload, @Param('id') id: string) {
    await this.pluggyService.removeConnection(payload.sub, id);
    return { success: true };
  }
}
