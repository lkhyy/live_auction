import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLiveRoomDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;
}

export class AddAuctionToRoomDto {
  @ApiProperty()
  @IsUUID()
  auctionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
