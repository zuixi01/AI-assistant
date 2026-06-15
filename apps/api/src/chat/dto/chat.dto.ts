import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ChatRequestDto {
  @IsUUID()
  conversationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  conversationToken?: string;
}
