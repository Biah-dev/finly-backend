import { IsInt, Max, Min } from 'class-validator';

export class UpdateAccountDto {
  @IsInt()
  @Min(1)
  @Max(31)
  billingCycleDay!: number;
}
