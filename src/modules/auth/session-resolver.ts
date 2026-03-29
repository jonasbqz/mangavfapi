import { auth } from '@/lib/auth';
import { profiles, session as authSession } from '@/database/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@/database/schema';

export async function resolveOptionalProfileId(
  db: NodePgDatabase<typeof schema>,
  headers: Record<string, any>,
): Promise<string | null> {
  let session = await auth.api.getSession({
    headers: headers as any,
  }).catch(() => null);

  if (!session?.user) {
    const authHeader = headers.authorization;
    if (
      typeof authHeader === 'string' &&
      authHeader.toLowerCase().startsWith('bearer ')
    ) {
      const tokenStr = authHeader.substring(7).trim();
      const sessionRecord = await db.query.session.findFirst({
        where: eq(authSession.token, tokenStr),
      });
      if (sessionRecord?.userId) {
        session = { user: { id: sessionRecord.userId } } as any;
      }
    }
  }

  if (!session?.user?.id) {
    return null;
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
    columns: { id: true },
  });

  return profile?.id ?? null;
}
