import { Module } from '@nestjs/common';
import { ModelConfigController } from './model-config.controller';
import { ModelConfigService } from './model-config.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ModelConfigController],
  providers: [ModelConfigService],
  exports: [ModelConfigService],
})
export class ModelConfigModule {}
