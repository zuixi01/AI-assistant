import { Module } from '@nestjs/common';
import { ReplyStrategyService } from './reply-strategy.service';

@Module({
  providers: [ReplyStrategyService],
  exports: [ReplyStrategyService],
})
export class ReplyStrategyModule {}
