import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthTokenPayload } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AccountsService } from './accounts.service.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

@Controller('accounts')
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Patch(':id')
  update(
    @CurrentUser() payload: AuthTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.updateBillingCycleDay(
      payload.sub,
      id,
      dto.billingCycleDay,
    );
  }
}
