import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { UserModel, UserPreferencesModel } from '../generated/prisma/models.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create({ name, email, passwordHash }: CreateUserInput) {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    return this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        preferences: { create: {} },
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing && existing.id !== userId) {
        throw new ConflictException('An account with this email already exists.');
      }
    }

    return this.prisma.user.update({ where: { id: userId }, data: dto });
  }

  async getPreferences(userId: string) {
    const preferences = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });
    if (!preferences) {
      throw new NotFoundException('Preferences not found.');
    }
    return this.serializePreferences(preferences);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const preferences = await this.prisma.userPreferences.update({
      where: { userId },
      data: dto,
    });
    return this.serializePreferences(preferences);
  }

  toPublicUser(user: UserModel) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
    };
  }

  private serializePreferences(preferences: UserPreferencesModel) {
    return {
      id: preferences.id,
      currency: preferences.currency,
      monthlyIncome: preferences.monthlyIncome?.toNumber() ?? null,
      budgetAlertThreshold: preferences.budgetAlertThreshold,
      billingCycleStart: preferences.billingCycleStart,
      lowBalanceAlert: preferences.lowBalanceAlert?.toNumber() ?? null,
      weeklySummaryEmail: preferences.weeklySummaryEmail,
      lowBalanceAlerts: preferences.lowBalanceAlerts,
      billReminders: preferences.billReminders,
    };
  }
}
