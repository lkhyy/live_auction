import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  displayName!: string;

  @ApiProperty({ enum: ['BUYER', 'HOST', 'ADMIN'], required: false })
  @IsOptional()
  @IsEnum(['BUYER', 'HOST', 'ADMIN'])
  role: 'BUYER' | 'HOST' | 'ADMIN' = 'BUYER';
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
