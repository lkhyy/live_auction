import { IsNumber, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlaceBidDto {
  @ApiProperty({ description: '出价金额，0 元起拍时首笔可为 0' })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersion?: number;
}
