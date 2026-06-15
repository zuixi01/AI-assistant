import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TestNotificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  content?: string;
}
