import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PriceAlertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  multiplier?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  absoluteThreshold?: number;
}

class AnomalyRangeDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() lowPriceRatio?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() highPriceRatio?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() appraisalPrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() rejectExtremeValues?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxReasonableMultiplier?: number;
}

class AnomalyIncrementDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxIncrementRatio?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxIncrementAmount?: number;
}

class AnomalyTimingDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() windowSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxBidsInWindow?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxUserBidsInWindow?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() endSnipeWindowSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() endSnipeIncrementRatio?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxUserTotalBids?: number;
}

class AnomalyCollusionDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() minBidders?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() spreadRatio?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() alternatingMinCycles?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() pumpTransferRatio?: number;
}

class AnomalyStatsDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() minSamples?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() stdDevMultiplier?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() isolationGapRatio?: number;
}

class AnomalyDetectionDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => AnomalyRangeDto) range?: AnomalyRangeDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => AnomalyIncrementDto) increment?: AnomalyIncrementDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => AnomalyTimingDto) timing?: AnomalyTimingDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => AnomalyCollusionDto) collusion?: AnomalyCollusionDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => AnomalyStatsDto) stats?: AnomalyStatsDto;
}

class SoftCloseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty()
  @IsNumber()
  extensionSeconds!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  triggerWindowSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxTotalExtensionSeconds?: number;
}

export class RulesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  startPrice?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  minIncrement!: number;

  @ApiPropertyOptional({ description: '最低成交价，低于此价流拍，不对买家展示' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  reservePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  capPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  durationSeconds?: number;

  @ApiProperty()
  @ValidateNested()
  @Type(() => SoftCloseDto)
  softClose!: SoftCloseDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowHostCancel?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => AnomalyDetectionDto)
  anomalyDetection?: AnomalyDetectionDto;

  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceAlertDto)
  priceAlert?: PriceAlertDto;
}

export class CreateAuctionDto {
  @ApiProperty()
  @IsUUID()
  lotId!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsObject()
  @ValidateNested()
  @Type(() => RulesDto)
  rules!: RulesDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scheduledStartAt?: string;
}
