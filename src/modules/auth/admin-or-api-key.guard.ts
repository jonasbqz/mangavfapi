import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { AdminGuard } from './admin.guard';
import { AuthGuard } from './auth.guard';

@Injectable()
export class AdminOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly authGuard: AuthGuard,
    private readonly adminGuard: AdminGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headerValue = request.headers['x-admin-api-key'];
    const configuredApiKey =
      this.configService.get<string>('MONLINE_ADMIN_API_KEY') || '';

    if (
      configuredApiKey &&
      typeof headerValue === 'string' &&
      this.keysMatch(configuredApiKey, headerValue)
    ) {
      return true;
    }

    await this.authGuard.canActivate(context);
    return this.adminGuard.canActivate(context);
  }

  private keysMatch(expected: string, received: string) {
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }
}
