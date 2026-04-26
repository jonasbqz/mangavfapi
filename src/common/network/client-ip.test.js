import { describe, expect, it } from 'bun:test';
import {
  appendForwardedClientHeaders,
  extractClientIpFromHeaders,
  getRequestClientIp,
} from './client-ip';

describe('client-ip helpers', () => {
  it('extracts the first ip from x-forwarded-for', () => {
    expect(
      extractClientIpFromHeaders({
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
      }),
    ).toBe('203.0.113.10');
  });

  it('prefers cf-connecting-ip over forwarded chains', () => {
    expect(
      extractClientIpFromHeaders({
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
        'cf-connecting-ip': '198.51.100.25',
      }),
    ).toBe('198.51.100.25');
  });

  it('skips Cloudflare proxy IPs and uses the first public forwarded client', () => {
    expect(
      extractClientIpFromHeaders({
        'cf-connecting-ip': '172.68.230.159',
        'x-forwarded-for': '45.5.10.20, 172.68.230.159, 10.0.0.1',
      }),
    ).toBe('45.5.10.20');
  });

  it('normalizes forwarded headers passed to downstream auth handlers', () => {
    const headers = appendForwardedClientHeaders(
      new Headers(),
      {
        'cf-connecting-ip': '172.68.230.159',
        'x-forwarded-for': '45.5.10.20, 172.68.230.159',
      },
    );

    expect(headers.get('cf-connecting-ip')).toBe('45.5.10.20');
    expect(headers.get('x-real-ip')).toBe('45.5.10.20');
  });

  it('normalizes ipv4 addresses with ports', () => {
    expect(
      extractClientIpFromHeaders({
        'x-real-ip': '198.51.100.25:443',
      }),
    ).toBe('198.51.100.25');
  });

  it('falls back to request.ip when headers do not contain a client ip', () => {
    expect(
      getRequestClientIp({
        headers: {},
        ip: '192.0.2.44',
        raw: { socket: { remoteAddress: '10.0.0.2' } },
      }),
    ).toBe('192.0.2.44');
  });

  it('falls back to socket remote address when request.ip is empty', () => {
    expect(
      getRequestClientIp({
        headers: {},
        ip: '',
        raw: { socket: { remoteAddress: '::ffff:192.0.2.88' } },
      }),
    ).toBe('192.0.2.88');
  });
});
