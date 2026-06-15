import { Module } from '@nestjs/common';
import { KnowledgeEnhancementsService } from './knowledge-enhancements.service';
import { KnowledgeEnhancementsController } from './knowledge-enhancements.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgeEnhancementsController],
  providers: [KnowledgeEnhancementsService],
  exports: [KnowledgeEnhancementsService],
})
export class KnowledgeEnhancementsModule {}
