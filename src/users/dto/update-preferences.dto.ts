import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Currency } from '../../generated/prisma/enums.js';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyIncome?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  budgetAlertThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  billingCycleStart?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowBalanceAlert?: number;

  @IsOptional()
  @IsBoolean()
  weeklySummaryEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  lowBalanceAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  billReminders?: boolean;
}
