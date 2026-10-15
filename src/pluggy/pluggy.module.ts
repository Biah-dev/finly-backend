import { Module } from '@nestjs/common';
import { JwtAuthModule } from '../auth/jwt-auth.module.js';
import { PluggyController } from './pluggy.controller.js';
import { PluggySyncService } from './pluggy-sync.service.js';
import { PluggyService } from './pluggy.service.js';

@Module({
  imports: [JwtAuthModule],
  controllers: [PluggyController],
  providers: [PluggyService, PluggySyncService],
})
export class PluggyModule {}
