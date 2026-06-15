import { Module } from '@nestjs/common';
import { MiniappService } from './miniapp.service';
import { MiniappController } from './miniapp.controller';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [MiniappController],
  providers: [MiniappService],
  exports: [MiniappService],
})
export class MiniappModule {}
