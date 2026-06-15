import { Module } from '@nestjs/common';
import { AfterSalesService } from './after-sales.service';
import { AfterSalesController } from './after-sales.controller';

@Module({
  controllers: [AfterSalesController],
  providers: [AfterSalesService],
  exports: [AfterSalesService],
})
export class AfterSalesModule {}
