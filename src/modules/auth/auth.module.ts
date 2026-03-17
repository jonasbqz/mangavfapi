import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { ProfileGuard } from './profile.guard';
import { AdminGuard } from './admin.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthGuard, ProfileGuard, AdminGuard],
  exports: [AuthGuard, ProfileGuard, AdminGuard],
})
export class AuthModule {}
