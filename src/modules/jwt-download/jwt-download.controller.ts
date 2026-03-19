import { Controller, Post, Req, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@/database/schema';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { profiles } from '@/database/schema';
import { auth } from '@/lib/auth';
import { JwtDownloadService } from './jwt-download.service';

@ApiTags('Download Token')
@Controller()
export class JwtDownloadController {
  constructor(
    private readonly jwtDownloadService: JwtDownloadService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * POST /api/download-token
   * Devuelve un JWT de descarga corto (5 min).
   * Si hay sesión activa → incluye userId, plan, isPremium.
   * Si no hay sesión → devuelve token anónimo (userId: null, plan: 'free').
   */
  @Post('download-token')
  @ApiOperation({
    summary: 'Generate a short-lived download JWT',
    description:
      'Authenticated users get a token with their plan. Anonymous users get a free-tier token valid for 10 minutes.',
  })
  async generateDownloadToken(@Req() request: FastifyRequest) {
    // Convertir las cabeceras de Fastify a un objeto Headers web estándar
    // requerido por better-auth para no fallar silenciosamente.
    const headers = new Headers();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers.append(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      }
    });

    // Intentar obtener sesión (manejando el error sin ocultarlo por completo)
    const session = await auth.api
      .getSession({ headers: headers as any })
      .catch((err) => {
        console.error('[jwt-download] Error getSession:', err);
        return null;
      });

    if (!session?.user) {
      // Token anónimo
      const token = await this.jwtDownloadService.generateToken({
        userId: null,
        plan: 'free',
        isPremium: false,
        premiumExpireAt: null,
        oneTimeUse: true,
      });
      return { token };
    }

    // Obtener perfil del usuario para saber el plan
    const profile = await this.db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
      columns: { plan: true, premiumExpireAt: true },
    });

    const plan = profile?.plan ?? 'basic';
    const premiumExpireAt = profile?.premiumExpireAt ?? null;
    const isPremium =
      plan === 'premium' &&
      (premiumExpireAt === null || premiumExpireAt > new Date());

    const token = await this.jwtDownloadService.generateToken({
      userId: session.user.id,
      plan: isPremium ? 'premium' : 'basic',
      isPremium,
      premiumExpireAt: premiumExpireAt?.toISOString() ?? null,
    });

    return { token };
  }
}
