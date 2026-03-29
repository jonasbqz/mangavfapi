import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID } from 'crypto';

type StorageProvider = 's3' | 'r2';

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function toDateStamp(date: Date) {
  return toAmzDate(date).slice(0, 8);
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function hashSha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

@Injectable()
export class StorageService {
  constructor(private readonly configService: ConfigService) {}

  private getConfig() {
    const provider = (this.configService.get<string>('STORAGE_PROVIDER') ||
      's3') as StorageProvider;
    const endpointValue = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION');
    const bucket = this.configService.get<string>('S3_BUCKET');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    const publicBaseUrl = this.configService.get<string>('S3_PUBLIC_BASE_URL');

    if (!endpointValue || !region || !bucket || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException(
        'Storage is not configured for uploads',
      );
    }

    return {
      provider,
      endpoint: new URL(endpointValue),
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      publicBaseUrl,
    };
  }

  private buildCanonicalUri(bucket: string, key: string) {
    const encodedKey = key
      .split('/')
      .map((part) => encodeRfc3986(part))
      .join('/');
    return `/${bucket}/${encodedKey}`;
  }

  private getSignatureKey(secretAccessKey: string, dateStamp: string, region: string) {
    const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, 's3');
    return hmac(kService, 'aws4_request');
  }

  private buildCanonicalQuery(query: Record<string, string>) {
    return Object.entries(query)
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
      .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
      .join('&');
  }

  buildPublicUrl(storageKey: string) {
    try {
      const { endpoint, bucket, publicBaseUrl } = this.getConfig();
      if (publicBaseUrl) {
        const normalized = publicBaseUrl.replace(/\/$/, '');
        return `${normalized}/${storageKey}`;
      }
      const canonicalUri = this.buildCanonicalUri(bucket, storageKey);
      return `${endpoint.protocol}//${endpoint.host}${canonicalUri}`;
    } catch {
      return storageKey;
    }
  }

  createStorageKey(profileId: string, fileName: string) {
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
    const now = new Date();
    const datePath = now.toISOString().slice(0, 10);
    return `comments/${profileId}/${datePath}/${randomUUID()}-${sanitizedName}`;
  }

  createUploadUrl(storageKey: string, expiresInSeconds = 900) {
    const {
      endpoint,
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
    } = this.getConfig();
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = toDateStamp(now);
    const host = endpoint.host;
    const canonicalUri = this.buildCanonicalUri(bucket, storageKey);
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const query: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresInSeconds),
      'X-Amz-SignedHeaders': 'host',
    };

    const canonicalQueryString = this.buildCanonicalQuery(query);
    const canonicalRequest = [
      'PUT',
      canonicalUri,
      canonicalQueryString,
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      hashSha256(canonicalRequest),
    ].join('\n');

    const signingKey = this.getSignatureKey(secretAccessKey, dateStamp, region);
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    return `${endpoint.protocol}//${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  async deleteObject(storageKey: string) {
    const {
      endpoint,
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
    } = this.getConfig();
    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = toDateStamp(now);
    const host = endpoint.host;
    const canonicalUri = this.buildCanonicalUri(bucket, storageKey);
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const payloadHash = hashSha256('');

    const canonicalRequest = [
      'DELETE',
      canonicalUri,
      '',
      `host:${host}\n` +
        `x-amz-content-sha256:${payloadHash}\n` +
        `x-amz-date:${amzDate}\n`,
      'host;x-amz-content-sha256;x-amz-date',
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      hashSha256(canonicalRequest),
    ].join('\n');

    const signingKey = this.getSignatureKey(secretAccessKey, dateStamp, region);
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    const authorization = [
      'AWS4-HMAC-SHA256 Credential=',
      `${accessKeyId}/${credentialScope}, `,
      'SignedHeaders=host;x-amz-content-sha256;x-amz-date, ',
      `Signature=${signature}`,
    ].join('');

    const response = await fetch(`${endpoint.protocol}//${host}${canonicalUri}`, {
      method: 'DELETE',
      headers: {
        host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorization,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new InternalServerErrorException('Failed to delete object from storage');
    }
  }
}
