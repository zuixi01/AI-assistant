import { IsOptional, IsString, MaxLength } from 'class-validator';

/** multipart 中与 file 同行的表单字段（class-validator + 全局 ValidationPipe） */
export class KnowledgeUploadFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  category?: string;

  /** 可选：标签，JSON 数组字符串 */
  @IsOptional()
  @IsString()
  tags?: string;

  /** 可选：优先级 */
  @IsOptional()
  priority?: number;

  /** 可选：描述 */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** 可选：上传文件解析后追加的手动说明或问答文本 */
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  extraText?: string;

  /** 可选：所属知识库 ID */
  @IsOptional()
  @IsString()
  knowledgeBaseId?: string;
}
