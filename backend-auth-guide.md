# Guía: Configuración de Autenticación para Dominios Separados

Al tener separado el **Frontend** (`mangolibreria.com` o `http://localhost:3000`) de tu **Backend** (`api.mangasx.online` o `http://localhost:8085`), los navegadores detectan que las peticiones van a un dominio de terceros (Cross-Site).

Por lo tanto, la estrategia que estabas usando con `crossSubDomainCookies` **NO funciona**, ya que los dominios raíz (`mangolibreria.com` y `mangasx.online`) son completamente diferentes.

Para que Better Auth funcione correctamente con dominios separados, debes forzar las cookies para que sean válidas de forma compartida (del tipo `sameSite: "none"`), que además siempre exige que sean seguras (`secure: true`).

## Cambios a realizar en tu Backend

Tu configuración de `auth.ts` **en el backend** debería quedar de la siguiente manera:

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
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
    // ... tu schema
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
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24 * 7,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60,
    },
  },
  trustedOrigins: [
    ...(process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'https://mangolibreria.com']),
    'https://mangolibreria.com',
    'https://www.mangolibreria.com',
  ],
  advanced: {
    // ❌ ELIMINADO: crossSubDomainCookies no funciona entre dominios distintos
    defaultCookieAttributes: {
      secure: true,      // ✅ OBLIGATORIO para sameSite "none"
      httpOnly: true,    // ✅ Protege contra XSS
      sameSite: 'none',  // ✅ PERMITE QUE EL FRONTEND LEA/ENVIE COOKIES AL BACKEND
    },
  },
});

export type Session = typeof auth.$Infer.Session;
```

## Cambios importantes resumidos:
1. **Eliminación de `crossSubDomainCookies`**: Ya no es necesario ni valido.
2. **Definir `secure: true` de forma estricta**: Chrome y Safari bloquearán la cookie instantáneamente si pones `sameSite: "none"` sin habilitar `secure: true`.
3. **Mantener `sameSite: 'none'`**: Crucial en el backend para que al mandar la cookie al frontend (`mangolibreria.com`), el navegador la acepte aunque haya venido de tu backend (`api...`).

## 🚨 ¡POR QUÉ SIGUE FALLANDO! (El problema de Firefox y Safari)
Si ya configuraste `sameSite: 'none'` y `secure: true`, el backend sí intentó enviar la cookie correctamente. Sin embargo, en tu error inicial se veían los siguientes encabezados del navegador:
```
Sec-Fetch-Site: cross-site
Sec-Fetch-Storage-Access: none
```
Esto ocurre porque **Firefox y Safari bloquean por defecto todas las cookies de terceros (Third-Party Cookies)** para evitar el rastreo entre sitios (Enhanced Tracking Protection / ITP).
Como `api.mangasx.online` (tu backend) y `mangolibreria.com` (tu frontend) son completamente distintos, el navegador rechaza guardar y enviar la cookie de sesión, sin importar cómo la configures.

## ¿Cómo solucionarlo DEFINITIVAMENTE?

Existen dos arquitecturas reales para solucionar esto:

### Solución 1: Usar un Subdominio (LO MÁS RECOMENDADO)
Hacer que tu backend esté bajo un subdominio de tu frontend principal para que dejen de ser un entorno "Cross-Site". Pasa a ser "Same-Site".
1. En vez de apuntar el frontend a `api.mangasx.online`, configura un CNAME o subdominio en tu DNS que sea `api.mangolibreria.com` y apúntalo hacia tu servidor backend.
2. En tu frontend, haz que todas las llamadas vayan a `https://api.mangolibreria.com`.
3. Vuelve a tu `.env` y usa `BASE_URL=https://api.mangolibreria.com`.
4. En `auth.ts`, vuelve a habilitar `crossSubDomainCookies`:
```typescript
advanced: {
  crossSubDomainCookies: {
    mainDomain: "mangolibreria.com"
  }
}
```
*De este modo, los navegadores tratarán a las cookies como propias (First-Party) y no las bloquearán.*

### Solución 2: Dejar de depender de Cookies (Si quieres mantener ambos dominios separados)
Debes usar *Bearer Tokens* en headers estándar de autorización. Retorna el token al frontend y envíalo cada vez que hagas `fetch()`. En el Frontend:
1. Obten la sesión sin guardar cookies obligatoriamente. Better Auth devuelve un `token` (si habilitas las opciones).
2. En todos tus fetch del cliente hacia `/api/bookmarks/favorites`, añade `Authorization: Bearer <TU_TOKEN>`.
Sin embargo, esto requiere modificar todas las llamadas a tu API desde el cliente. La Solución 1 es con diferencia la más rápida y estándar para autenticación hoy en día.

