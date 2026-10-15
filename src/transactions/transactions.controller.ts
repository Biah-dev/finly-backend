import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthTokenPayload } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto.js';
import { TransactionsService } from './transactions.service.js';

@Controller('transactions')
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  list(
    @CurrentUser() payload: AuthTokenPayload,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.transactionsService.listForUser(payload.sub, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
      accountType: query.accountType,
    });
  }

  @Get('credit-card-bills')
  listCreditCardBills(@CurrentUser() payload: AuthTokenPayload) {
    return this.transactionsService.listCreditCardBills(payload.sub);
  }
}
