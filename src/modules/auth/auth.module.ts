import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { ProfileGuard } from './profile.guard';
import { AdminGuard } from './admin.guard';
import { AdminOrApiKeyGuard } from './admin-or-api-key.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthGuard, ProfileGuard, AdminGuard, AdminOrApiKeyGuard],
  exports: [AuthGuard, ProfileGuard, AdminGuard, AdminOrApiKeyGuard],
})
export class AuthModule {}
