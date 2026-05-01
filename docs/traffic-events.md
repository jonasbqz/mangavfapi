# Traffic Events / Bot Learning

Objetivo: aprender patrones de bots o tráfico de datacenter sin bloquear buscadores legítimos.

## Qué registra

La API persiste eventos en `traffic_events` para:

- `comic_search`: búsquedas en `/api/comics?search=...`
- `comic_list`: listados sin búsqueda
- `comic_lookup`: resolución de rutas/canonicals
- `comic_view`: vista de un comic
- `chapter_lookup`: resolución de rutas/canonicals de capítulos
- `chapter_view`: vista de capítulo
- `chapter_pages`: solicitud de páginas de capítulo

Cada evento guarda IP normalizada, user-agent, ruta, usuario autenticado si llega por header interno, score de riesgo y razones.

## Configuración

- `TRAFFIC_EVENTS_ENABLED=false`: desactiva toda la captura.
- `TRAFFIC_EVENTS_PERSIST_ENABLED=false`: calcula señales/counters pero no escribe en DB.
- `BOT_WATCH_ASNS=51167`: ASNs a vigilar. `51167` es Contabo. También acepta `AS51167`.
- `BOT_WATCH_IP_CIDRS=1.2.3.0/24,5.6.7.8`: rangos IP a vigilar, por ejemplo rangos Contabo que se detecten en logs.
- También se aceptan alias: `SUSPICIOUS_IP_CIDRS`, `BOT_DATACENTER_IP_CIDRS`, `SUSPICIOUS_ASNS` o `BOT_DATACENTER_ASNS`.

## Configuración CDN recomendada

Para detectar Contabo por ASN sin mantener cientos de CIDRs, haz que el CDN
reenvíe el ASN al origen:

- Cloudflare Transform Rule: añadir header `x-client-asn` con el valor dinámico `cf.asn`.
- Si no usas Cloudflare Transform Rules, puedes enviar cualquiera de estos headers desde tu proxy/CDN: `cf-connecting-asn`, `cf-asn`, `x-client-asn`, `x-asn` o `x-vercel-ip-as-number`.

Con eso, `BOT_WATCH_ASNS=51167` marcará tráfico de Contabo como `watchlisted_datacenter_asn`.

## Migración

La migración `0012_traffic_events.sql` fue añadida como SQL manual.
Como el proyecto tiene migraciones manuales fuera del journal de Drizzle,
no dependas de que `bun drizzle-kit migrate` la descubra automáticamente.

Aplicar en producción con tu gestor SQL o con `psql`:

```bash
psql "$DATABASE_URL" -f src/database/migrations/0012_traffic_events.sql
```

Si tu pipeline ya aplica todos los `.sql` nuevos de `src/database/migrations`,
solo asegúrate de que incluya `0012_traffic_events.sql`.

## Consultas admin

Requieren sesión admin o `x-admin-api-key`.

```bash
GET /api/traffic-events/recent?minRisk=35&limit=100
GET /api/traffic-events/suspicious?hours=24&limit=100
```

## Importante

Esta fase es de observación: no devuelve 404 ni bloquea buscadores. Sirve para identificar IPs, user-agents y patrones repetidos antes de activar bloqueo selectivo.
