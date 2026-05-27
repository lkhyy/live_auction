import { IsOptional, IsString, IsUrl, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLotDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateLotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;
}
