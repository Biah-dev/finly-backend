import { Module } from '@nestjs/common';
import { JwtAuthModule } from '../auth/jwt-auth.module.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

@Module({
  imports: [JwtAuthModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
