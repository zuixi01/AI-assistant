import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePublicMessageDto {
  @IsOptional()
  @IsIn(['user'])
  role?: 'user';

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}

export class PublicMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @IsOptional()
  @IsDateString()
  after?: string;
}

export class CreateHumanReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}
