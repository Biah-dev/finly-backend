import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const ACCOUNT_TYPES = ['BANK', 'CREDIT'] as const;
export type AccountTypeFilter = (typeof ACCOUNT_TYPES)[number];

export class ListTransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;

  @IsOptional()
  @IsIn(ACCOUNT_TYPES)
  accountType?: AccountTypeFilter;
}
