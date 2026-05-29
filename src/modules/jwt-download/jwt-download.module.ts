import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/database/database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { JwtDownloadService } from './jwt-download.service';
import { JwtDownloadController } from './jwt-download.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [JwtDownloadController],
  providers: [JwtDownloadService],
  exports: [JwtDownloadService],
})
export class JwtDownloadModule {}
