import type { FastifyRequest } from 'fastify';

type HeaderAccessor =
  | Headers
  | Record<string, unknown>
  | {
      get(name: string): string | null;
    }
  | undefined
  | null;

const IP_HEADER_CANDIDATES = [
  'cf-connecting-ip',
  'true-client-ip',
  'x-real-ip',
  'x-client-ip',
  'x-forwarded-for',
] as const;

const CLOUDFLARE_IPV4_CIDRS = [
  ['173.245.48.0', 20],
  ['103.21.244.0', 22],
  ['103.22.200.0', 22],
  ['103.31.4.0', 22],
  ['141.101.64.0', 18],
  ['108.162.192.0', 18],
  ['190.93.240.0', 20],
  ['188.114.96.0', 20],
  ['197.234.240.0', 22],
  ['198.41.128.0', 17],
  ['162.158.0.0', 15],
  ['104.16.0.0', 13],
  ['104.24.0.0', 14],
  ['172.64.0.0', 13],
  ['131.0.72.0', 22],
] as const;

function readHeader(headers: HeaderAccessor, name: string): string {
  if (!headers) {
    return '';
  }

  if (typeof (headers as { get?: unknown }).get === 'function') {
    return ((headers as { get(name: string): string | null }).get(name) || '').trim();
  }

  const record = headers as Record<string, unknown>;
  const direct = record[name];
  if (typeof direct === 'string') {
    return direct.trim();
  }

  if (Array.isArray(direct)) {
    return String(direct[0] || '').trim();
  }

  const normalizedKey = Object.keys(record).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );

  if (!normalizedKey) {
    return '';
  }

  const normalizedValue = record[normalizedKey];
  if (typeof normalizedValue === 'string') {
    return normalizedValue.trim();
  }

  if (Array.isArray(normalizedValue)) {
    return String(normalizedValue[0] || '').trim();
  }

  return '';
}

function normalizeSingleIpCandidate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') {
    return null;
  }

  const forwardedMatch = trimmed.match(/for=(?:"?\[?)([a-f0-9:.]+)(?:\]?"?)/i);
  let normalized = (forwardedMatch?.[1] || trimmed)
    .replace(/^"+|"+$/g, '')
    .trim();

  const bracketedIpv6WithPort = normalized.match(/^\[([a-f0-9:]+)\](?::\d+)?$/i);
  if (bracketedIpv6WithPort) {
    normalized = bracketedIpv6WithPort[1];
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(normalized)) {
    normalized = normalized.split(':')[0];
  }

  if (normalized.startsWith('::ffff:')) {
    normalized = normalized.slice(7);
  }

  return normalized || null;
}

function normalizeIpCandidates(value: string): string[] {
  return value
    .split(',')
    .map((candidate) => normalizeSingleIpCandidate(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));
}

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
    return null;
  }

  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function isPrivateIp(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80')
  ) {
    return true;
  }

  const number = ipv4ToNumber(ip);
  if (number === null) {
    return false;
  }

  const [a, b] = ip.split('.').map((part) => Number.parseInt(part, 10));
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

function isIpInCidr(ip: string, cidrBase: string, prefix: number): boolean {
  const ipNumber = ipv4ToNumber(ip);
  const baseNumber = ipv4ToNumber(cidrBase);
  if (ipNumber === null || baseNumber === null) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipNumber & mask) === (baseNumber & mask);
}

function isCloudflareProxyIp(ip: string): boolean {
  return CLOUDFLARE_IPV4_CIDRS.some(([cidrBase, prefix]) =>
    isIpInCidr(ip, cidrBase, prefix),
  );
}

function isLikelyOriginProxyIp(ip: string): boolean {
  return isPrivateIp(ip) || isCloudflareProxyIp(ip);
}

export function extractClientIpFromHeaders(headers: HeaderAccessor): string | null {
  const cloudflareIp = normalizeSingleIpCandidate(readHeader(headers, 'cf-connecting-ip'));
  if (cloudflareIp && !isLikelyOriginProxyIp(cloudflareIp)) {
    return cloudflareIp;
  }

  const trueClientIp = normalizeSingleIpCandidate(readHeader(headers, 'true-client-ip'));
  if (trueClientIp && !isLikelyOriginProxyIp(trueClientIp)) {
    return trueClientIp;
  }

  const forwardedForCandidates = normalizeIpCandidates(readHeader(headers, 'x-forwarded-for'));
  const firstForwardedPublicClient = forwardedForCandidates.find(
    (candidate) => !isLikelyOriginProxyIp(candidate),
  );
  if (firstForwardedPublicClient) {
    return firstForwardedPublicClient;
  }

  for (const headerName of IP_HEADER_CANDIDATES.filter(
    (name) => !['cf-connecting-ip', 'true-client-ip', 'x-forwarded-for'].includes(name),
  )) {
    const normalized = normalizeSingleIpCandidate(readHeader(headers, headerName));
    if (normalized && !isLikelyOriginProxyIp(normalized)) {
      return normalized;
    }
  }

  const forwarded = readHeader(headers, 'forwarded');
  const forwardedCandidate = normalizeSingleIpCandidate(forwarded);
  if (forwardedCandidate && !isLikelyOriginProxyIp(forwardedCandidate)) {
    return forwardedCandidate;
  }

  return (
    cloudflareIp ||
    trueClientIp ||
    forwardedForCandidates[0] ||
    forwardedCandidate ||
    null
  );
}

export function appendForwardedClientHeaders(
  targetHeaders: Headers,
  sourceHeaders: HeaderAccessor,
): Headers {
  const clientIp = extractClientIpFromHeaders(sourceHeaders);

  if (clientIp) {
    const existingForwardedFor = targetHeaders.get('x-forwarded-for');
    targetHeaders.set(
      'x-forwarded-for',
      existingForwardedFor
        ? `${clientIp}, ${existingForwardedFor}`
        : clientIp,
    );
    targetHeaders.set('x-real-ip', clientIp);
    targetHeaders.set('x-client-ip', clientIp);
    targetHeaders.set('cf-connecting-ip', clientIp);
    targetHeaders.set('true-client-ip', clientIp);
  }

  const forwardedProto = readHeader(sourceHeaders, 'x-forwarded-proto');
  if (forwardedProto && !targetHeaders.has('x-forwarded-proto')) {
    targetHeaders.set('x-forwarded-proto', forwardedProto);
  }

  const forwardedHost = readHeader(sourceHeaders, 'x-forwarded-host');
  if (forwardedHost && !targetHeaders.has('x-forwarded-host')) {
    targetHeaders.set('x-forwarded-host', forwardedHost);
  }

  const forwarded = readHeader(sourceHeaders, 'forwarded');
  if (forwarded && !targetHeaders.has('forwarded')) {
    targetHeaders.set('forwarded', forwarded);
  }

  return targetHeaders;
}


type RequestLike = Pick<FastifyRequest, 'headers' | 'ip' | 'raw'>;

export function getRequestClientIp(request: RequestLike): string | null {
  return (
    extractClientIpFromHeaders(request.headers) ||
    normalizeSingleIpCandidate(request.ip || '') ||
    normalizeSingleIpCandidate(request.raw?.socket?.remoteAddress || '')
  );
}
