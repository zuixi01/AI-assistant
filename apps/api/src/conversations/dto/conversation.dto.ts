import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CONVERSATION_STATUS, ConversationStatus } from '../conversations.service';

export class CreateConversationDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  tenantSlug?: string;

  @IsString()
  @MaxLength(64)
  channel!: string;

  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class UpdateConversationStatusDto {
  @IsIn(Object.values(CONVERSATION_STATUS))
  status!: ConversationStatus;
}
