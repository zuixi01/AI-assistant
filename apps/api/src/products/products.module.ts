import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule, KnowledgeModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
