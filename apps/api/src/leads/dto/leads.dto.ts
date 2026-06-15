import { Allow, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreatePublicLeadDto {
  @IsUUID()
  conversationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  conversationToken?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(32)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  followStatus?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remark?: string;

  @IsOptional()
  @Allow()
  tags?: any;
}
