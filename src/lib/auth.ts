import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins/bearer';
import { Pool } from 'pg';
import * as schema from '@/database/schema';
import { drizzle } from 'drizzle-orm/node-postgres';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BASE_URL || 'http://localhost:8085',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24 * 7, // 7 days (refresh session weekly)
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60, // 1 hour cache
    },
  },
  trustedOrigins: [
    ...(process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'https://mangolibreria.com']),
    'https://mangolibreria.com',
    'https://www.mangolibreria.com',
    'http://mangas-mainmango-3i1hl5:8087',
  ],
  advanced: {
    // ❌ ELIMINADO: crossSubDomainCookies no funciona entre dominios distintos
    defaultCookieAttributes: {
      secure: true,      // ✅ OBLIGATORIO para sameSite "none"
      httpOnly: true,    // ✅ Protege contra XSS
      sameSite: 'none',  // ✅ PERMITE QUE EL FRONTEND LEA/ENVIE COOKIES AL BACKEND
    },
  },
  plugins: [bearer()],
});

export type Session = typeof auth.$Infer.Session;
