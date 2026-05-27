import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
