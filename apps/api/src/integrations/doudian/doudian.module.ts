import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ProductsModule } from '../../products/products.module';
import { DoudianConnectorFactory } from './doudian-connector.factory';
import { DoudianController } from './doudian.controller';
import { DoudianService } from './doudian.service';

@Module({
  imports: [PrismaModule, ProductsModule],
  controllers: [DoudianController],
  providers: [DoudianService, DoudianConnectorFactory],
  exports: [DoudianService],
})
export class DoudianModule {}
