import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class JuguangWebhookDto {
  @IsString()
  event_type!: string; // im.send, im.bind_account, lead.submit, etc.

  @IsOptional()
  @IsString()
  app_id?: string;

  @IsOptional()
  data?: any;
}

export class JuguangBindAccountDto {
  @IsString()
  appId!: string;

  @IsOptional()
  @IsString()
  appSecret?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsBoolean()
  autoReply?: boolean;

  @IsOptional()
  config?: Record<string, any>;
}

export class JuguangSendMessageDto {
  @IsString()
  accountId!: string;

  @IsString()
  toUserId!: string;

  @IsString()
  content!: string;
}
