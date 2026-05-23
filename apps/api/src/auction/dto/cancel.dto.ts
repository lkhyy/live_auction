import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelAuctionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  reason!: string;
}
