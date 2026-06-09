# Traffic Events / Bot Learning

Objetivo: aprender patrones de bots o tráfico de datacenter sin bloquear buscadores legítimos y sin hacer crecer la base de datos de forma explosiva.

## Modelo actual

La fuente principal de detección es `traffic_subject_windows`: una tabla agregada por sujeto + hora.

`traffic_events` ya no debe guardar cada request. Ahora solo guarda evidencia cruda:

- eventos con riesgo >= `TRAFFIC_RAW_MIN_RISK_SCORE`;
- acciones no `allow`;
- una muestra mínima de tráfico bajo riesgo (`TRAFFIC_RAW_SAMPLE_RATE`);
- todo con throttle por sujeto/tipo/riesgo (`TRAFFIC_RAW_THROTTLE_MS`).

Esto reduce crecimiento de filas y permite detectar patrones reales con contadores agregados.

## Qué observa

La API procesa señales para:

- `comic_search`: búsquedas en `/api/comics?search=...`
- `comic_list`: listados sin búsqueda
- `comic_lookup`: resolución de rutas/canonicals
- `comic_view`: vista de un comic
- `chapter_lookup`: resolución de rutas/canonicals de capítulos
- `chapter_view`: vista de capítulo
- `chapter_pages`: solicitud de páginas de capítulo

Señales de patrón:

- requests por minuto;
- búsquedas por minuto;
- vistas de contenido por minuto;
- misma búsqueda repetida;
- misma ruta repetida;
- muchas rutas únicas en 10 minutos;
- muchas búsquedas únicas en 10 minutos;
- ASN/IP watchlist, por ejemplo Contabo AS51167;
- user-agent tipo bot/script.

## Configuración

- `TRAFFIC_EVENTS_ENABLED=false`: desactiva toda la captura.
- `TRAFFIC_EVENTS_PERSIST_ENABLED=false`: calcula señales/counters pero no escribe en DB.
- `BOT_WATCH_ASNS=51167`: ASNs a vigilar. `51167` es Contabo. También acepta `AS51167`.
- `BOT_WATCH_IP_CIDRS=1.2.3.0/24,5.6.7.8`: rangos IP a vigilar, por ejemplo rangos Contabo que se detecten en logs.
- `TRAFFIC_RAW_MIN_RISK_SCORE=35`: solo persistir raw events desde este riesgo.
- `TRAFFIC_RAW_SAMPLE_RATE=0.002`: muestra de tráfico bajo riesgo. `0` desactiva muestras.
- `TRAFFIC_RAW_THROTTLE_MS=30000`: mínimo entre raw rows del mismo sujeto/tipo/riesgo.
- `TRAFFIC_RAW_RETENTION_DAYS=2`: retención de evidencia cruda.
- `TRAFFIC_AGGREGATE_RETENTION_DAYS=30`: retención de rollups por hora.
- `BOT_BLOCK_DATACENTER=true`: bloquea inmediatamente ASN/CIDR en watchlist, salvo crawlers permitidos o allowlist.
- `BOT_BLOCK_FAST_REQUESTS=true`: bloquea ráfagas rápidas al momento con 404.
- `BOT_MAX_REQUESTS_PER_MINUTE=120`: máximo de requests/min por sujeto.
- `BOT_MAX_SEARCHES_PER_MINUTE=30`: máximo de búsquedas/min por sujeto.
- `BOT_MAX_CONTENT_VIEWS_PER_MINUTE=80`: máximo de vistas de contenido/min por sujeto.
- `BOT_MAX_UNIQUE_PATHS_10M=80`: máximo de rutas únicas en 10 min.
- `BOT_MAX_UNIQUE_SEARCHES_10M=40`: máximo de búsquedas únicas en 10 min.
- `BOT_ALLOW_IPS`, `BOT_ALLOW_IP_CIDRS`, `BOT_ALLOW_ASNS`: redes de confianza que nunca se bloquean.
- También se aceptan alias: `SUSPICIOUS_IP_CIDRS`, `BOT_DATACENTER_IP_CIDRS`, `SUSPICIOUS_ASNS` o `BOT_DATACENTER_ASNS`.

## Búsquedas (`429`)

El rate limit de búsqueda ya no trata la paginación igual que una búsqueda nueva:

- `page > 1` con el mismo término usa un bucket de paginación más amplio (`SEARCH_RATE_PAGINATION_PER_30S`, default `50` / 30s).
- un término nuevo usa `SEARCH_RATE_NEW_PER_MINUTE` (default `20` / min).
- refrescar la misma búsqueda en página 1 usa `SEARCH_RATE_SAME_QUERY_REFRESH_PER_30S` (default `20` / 30s).
- si el usuario abrió cómics/capítulos recientemente (`human:*:engaged`) o está autenticado, los límites se multiplican.

## Bloqueo inline

El sistema ya no espera a que el panel muestre eventos: cada request actualiza contadores en Redis y puede devolver 404 inmediatamente cuando:

- el ASN/IP está en watchlist de datacenter (`BOT_WATCH_ASNS`, `BOT_WATCH_IP_CIDRS`);
- supera umbrales de requests rápidos;
- supera umbrales de búsquedas rápidas;
- supera umbrales de vistas rápidas;
- recorre demasiadas rutas o búsquedas únicas en 10 minutos.

Excepciones:

- crawlers de búsqueda permitidos por user-agent;
- IPs privadas internas como `10.0.1.14` se ignoran como llamadas de origen/SSR y no se guardan como sujeto;
- redes configuradas en `BOT_ALLOW_*`.

## Configuración CDN recomendada

Para detectar Contabo por ASN sin mantener cientos de CIDRs, haz que el CDN
reenvíe el ASN al origen:

- Cloudflare Transform Rule: añadir header `x-client-asn` con el valor dinámico `cf.asn`.
- Si no usas Cloudflare Transform Rules, puedes enviar cualquiera de estos headers desde tu proxy/CDN: `cf-connecting-asn`, `cf-asn`, `x-client-asn`, `x-asn` o `x-vercel-ip-as-number`.

Con eso, `BOT_WATCH_ASNS=51167` marcará tráfico de Contabo como `watchlisted_datacenter_asn`.

## Migración

Aplicar ambas migraciones manuales:

```bash
psql "$DATABASE_URL" -f src/database/migrations/0012_traffic_events.sql
psql "$DATABASE_URL" -f src/database/migrations/0013_traffic_rollups.sql
```

Si no tienes `psql`, puedes aplicar los SQL con `pg`/Bun igual que se hizo localmente.

## Limpieza de datos anteriores

El servicio borra automáticamente:

- raw events de bajo riesgo mayores a 6 horas;
- raw events mayores a `TRAFFIC_RAW_RETENTION_DAYS`;
- rollups mayores a `TRAFFIC_AGGREGATE_RETENTION_DAYS`.

Para una limpieza inmediata de datos crudos viejos, ejecutar manualmente con cuidado:

```sql
DELETE FROM traffic_events
WHERE occurred_at < now() - interval '2 days'
   OR (risk_score < 35 AND occurred_at < now() - interval '6 hours');
VACUUM (ANALYZE) traffic_events;
```

## Consultas admin

Requieren sesión admin o `x-admin-api-key`.

```bash
GET /api/traffic-events/recent?minRisk=35&limit=100
GET /api/traffic-events/suspicious?hours=24&limit=100
```

`/suspicious` usa `traffic_subject_windows`, no la tabla raw.

## Importante

Esta fase es de observación: no devuelve 404 ni bloquea buscadores. Sirve para identificar IPs, user-agents y patrones repetidos antes de activar bloqueo selectivo.
