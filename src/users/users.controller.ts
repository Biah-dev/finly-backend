import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthTokenPayload } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UsersService } from './users.service.js';

@Controller('users/me')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getProfile(@CurrentUser() payload: AuthTokenPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return this.usersService.toPublicUser(user);
  }

  @Patch()
  async updateProfile(
    @CurrentUser() payload: AuthTokenPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.usersService.updateProfile(payload.sub, dto);
    return this.usersService.toPublicUser(user);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() payload: AuthTokenPayload) {
    return this.usersService.getPreferences(payload.sub);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser() payload: AuthTokenPayload,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.usersService.updatePreferences(payload.sub, dto);
  }
}
