import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'ops@lingnanfresh.cn' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'FreshOps2026!' })
  @IsString()
  @MinLength(6)
  password: string;
}
