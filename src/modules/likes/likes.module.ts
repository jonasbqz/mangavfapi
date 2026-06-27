import { Module } from '@nestjs/common';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';
import { AuthModule } from '@/modules/auth/auth.module';
import { RedisCacheModule } from '@/cache/cache.module';

@Module({
  imports: [AuthModule, RedisCacheModule],
  controllers: [LikesController],
  providers: [LikesService],
  exports: [LikesService],
})
export class LikesModule {}
