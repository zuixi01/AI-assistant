import { Module } from '@nestjs/common';
import { UnknownQuestionsService } from './unknown-questions.service';
import { UnknownQuestionsController } from './unknown-questions.controller';

@Module({
  controllers: [UnknownQuestionsController],
  providers: [UnknownQuestionsService],
  exports: [UnknownQuestionsService],
})
export class UnknownQuestionsModule {}
