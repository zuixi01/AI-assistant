import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class ChatGptOnCsMessageDto {
  @IsString()
  platform!: string;

  @IsString()
  fromUserId!: string;

  @IsString()
  @IsOptional()
  fromNickname?: string;

  @IsString()
  toUserId!: string;

  @IsString()
  content!: string;

  @IsString()
  @IsOptional()
  messageType?: string;

  @IsString()
  @IsOptional()
  platformMessageId?: string;

  @IsString()
  @IsOptional()
  accountId?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class ChatGptOnCsAccountDto {
  @IsString()
  platform!: string;

  @IsString()
  platformUserId!: string;

  @IsString()
  @IsOptional()
  platformNickname?: string;

  @IsString()
  @IsOptional()
  accessToken?: string;

  @IsOptional()
  config?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  autoReply?: boolean;
}

export class ChatGptOnCsReplyCallbackDto {
  @IsString()
  platform!: string;

  @IsString()
  toUserId!: string;

  @IsString()
  content!: string;

  @IsString()
  @IsOptional()
  messageType?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
