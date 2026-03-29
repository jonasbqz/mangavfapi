import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { EntityReactionsController } from './entity-reactions.controller';
import { EntityReactionsService } from './entity-reactions.service';

@Module({
  imports: [AuthModule],
  controllers: [EntityReactionsController],
  providers: [EntityReactionsService],
  exports: [EntityReactionsService],
})
export class EntityReactionsModule {}
