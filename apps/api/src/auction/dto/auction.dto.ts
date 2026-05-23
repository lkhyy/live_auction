import { Type } from 'class-transformer';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class SoftCloseDto {
  @ApiPropertyOptional()
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
