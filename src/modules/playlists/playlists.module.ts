import { Module } from '@nestjs/common';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { AuthModule } from '@/modules/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
