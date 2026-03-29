import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { ProfileGuard } from '@/modules/auth/profile.guard';
import { CurrentUser, UserSession } from '@/modules/auth/current-user.decorator';
import { MediaService } from './media.service';
import {
  CreateUploadSessionDto,
  RegisterExternalMediaDto,
} from './media.dto';

@ApiTags('Media')
@Controller('media')
@UseGuards(AuthGuard, ProfileGuard)
@ApiBearerAuth()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('gallery')
  @ApiOperation({ summary: 'List current user reusable media gallery' })
  async getGallery(@CurrentUser() user: UserSession) {
    return this.mediaService.listGallery(user.profileId!);
  }

  @Post('external')
  @ApiOperation({ summary: 'Register an external media URL in gallery' })
  async registerExternal(
    @CurrentUser() user: UserSession,
    @Body() dto: RegisterExternalMediaDto,
  ) {
    return this.mediaService.registerExternal(user.profileId!, dto);
  }

  @Post('upload-session')
  @ApiOperation({ summary: 'Create a presigned upload session for premium users' })
  async createUploadSession(
    @CurrentUser() user: UserSession,
    @Body() dto: CreateUploadSessionDto,
  ) {
    return this.mediaService.createUploadSession(user.profileId!, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a media asset from gallery' })
  async deleteAsset(
    @CurrentUser() user: UserSession,
    @Param('id') id: string,
  ) {
    return this.mediaService.deleteAsset(user.profileId!, id);
  }
}
