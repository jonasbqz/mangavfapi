/**
 * Desbloquea todos los sujetos activos en traffic_blocked_subjects.
 *
 * Uso:
 *   bun run scripts/unblock-all-traffic-blocks.ts
 *   bun run scripts/unblock-all-traffic-blocks.ts --dry-run
 */

import { Pool } from 'pg';

const isDryRun = process.argv.includes('--dry-run');
const reason = process.argv.find((arg) => arg.startsWith('--reason='))?.slice('--reason='.length)
  || 'mass_unblock_emergency';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const counts = await pool.query<{ status: string; total: string }>(`
      select status, count(*)::text as total
      from traffic_blocked_subjects
      group by status
      order by count(*) desc
    `);

    console.log('Estado actual:');
    for (const row of counts.rows) {
      console.log(`  ${row.status}: ${row.total}`);
    }

    const active = await pool.query<{ total: string }>(`
      select count(*)::text as total
      from traffic_blocked_subjects
      where status = 'active'
        and (blocked_until is null or blocked_until > now())
    `);
    const activeCount = Number(active.rows[0]?.total || 0);
    console.log(`\nBloqueos activos ahora: ${activeCount}`);

    if (activeCount === 0) {
      console.log('Nada que desbloquear.');
      return;
    }

    if (isDryRun) {
      console.log('\n[dry-run] No se aplicaron cambios.');
      return;
    }

    const result = await pool.query<{ subject_key: string }>(`
      update traffic_blocked_subjects
      set
        status = 'unblocked',
        blocked_until = null,
        unblocked_at = now(),
        unblock_reason = $1
      where status = 'active'
      returning subject_key
    `, [reason]);

    console.log(`\nDesbloqueados: ${result.rowCount ?? result.rows.length}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('ERROR:', error instanceof Error ? error.message : error);
  process.exit(1);
});
