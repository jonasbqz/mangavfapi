import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import type { UserSession } from './current-user.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as any).user as UserSession | undefined;

    if (!user) {
      throw new ForbiddenException('Admin access required');
    }

    const allowedUserIds = this.parseList(
      this.configService.get<string>('ADMIN_USER_IDS'),
    );
    const allowedEmails = this.parseList(
      this.configService.get<string>('ADMIN_EMAILS'),
    );

    const isAllowed =
      allowedUserIds.includes(user.userId) ||
      (user.email ? allowedEmails.includes(user.email.toLowerCase()) : false);

    if (!isAllowed) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }

  private parseList(value?: string): string[] {
    if (!value) return [];

    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => entry.toLowerCase());
  }
}
