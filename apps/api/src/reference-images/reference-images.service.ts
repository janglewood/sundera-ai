import { BadRequestException, Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import * as net from 'node:net';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_FETCH_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; SunderaAI-ReferenceImageFetcher/1.0)';

// Order matters: prefer the highest-fidelity tag Pinterest/OG-compliant pages expose.
const OG_IMAGE_PATTERNS = [
  /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']/i,
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
];

interface FetchedResource {
  buffer: Buffer;
  contentType: string;
  finalUrl: string;
}

@Injectable()
export class ReferenceImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async saveUpload(file: Express.Multer.File) {
    const ext = ALLOWED_MIME_TYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Use JPEG, PNG, or WebP.`,
      );
    }
    return this.store(file.buffer, file.mimetype, ext);
  }

  async saveFromUrl(url: string) {
    const { buffer, mimeType } = await this.fetchImage(url);
    const ext = ALLOWED_MIME_TYPES[mimeType];
    if (!ext) {
      throw new BadRequestException(
        `Unsupported image type at that link: ${mimeType}. Use JPEG, PNG, or WebP.`,
      );
    }
    return this.store(buffer, mimeType, ext, url);
  }

  private async store(
    buffer: Buffer,
    mimeType: string,
    ext: string,
    sourceUrl?: string,
  ) {
    const id = uuid();
    const storageKey = this.storage.buildObjectKey('references', id, ext);
    await this.storage.putObject(storageKey, buffer, mimeType);

    const referenceImage = await this.prisma.referenceImage.create({
      data: { id, storageKey, mimeType, sourceUrl },
    });

    const previewUrl = await this.storage.getPresignedGetUrl(storageKey);
    return { id: referenceImage.id, previewUrl };
  }

  /**
   * Resolves a pasted link to image bytes. Handles both direct image URLs and
   * pages (e.g. a Pinterest pin) that expose their image via OG/Twitter meta tags.
   */
  private async fetchImage(
    startUrl: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const first = await this.safeFetch(startUrl);

    if (ALLOWED_MIME_TYPES[first.contentType]) {
      return { buffer: first.buffer, mimeType: first.contentType };
    }

    if (first.contentType.includes('text/html')) {
      const ogImageUrl = this.extractOgImageUrl(
        first.buffer.toString('utf-8'),
        first.finalUrl,
      );
      if (!ogImageUrl) {
        throw new BadRequestException('Could not find an image at that link');
      }
      const image = await this.safeFetch(ogImageUrl);
      if (!ALLOWED_MIME_TYPES[image.contentType]) {
        throw new BadRequestException('Could not find an image at that link');
      }
      return { buffer: image.buffer, mimeType: image.contentType };
    }

    throw new BadRequestException('Could not find an image at that link');
  }

  /**
   * Fetches a URL with SSRF guards: only http/https, DNS-resolved host must not
   * be a private/loopback/link-local address, manual redirect following so every
   * hop is re-checked, a timeout, and a hard cap on bytes read.
   */
  private async safeFetch(targetUrl: string): Promise<FetchedResource> {
    let currentUrl = targetUrl;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const parsed = this.parseHttpUrl(currentUrl);
      await this.assertPublicHost(parsed.hostname);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(parsed.toString(), {
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'image/*,text/html;q=0.8,*/*;q=0.5',
          },
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new BadRequestException('Timed out fetching that link');
        }
        throw new BadRequestException('Could not reach that link');
      } finally {
        clearTimeout(timeout);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new BadRequestException('Could not reach that link');
        }
        currentUrl = new URL(location, parsed).toString();
        continue;
      }

      if (!response.ok) {
        throw new BadRequestException(
          `That link returned an error (${response.status})`,
        );
      }

      const contentType =
        response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ??
        '';
      const buffer = await this.readCapped(response);
      return { buffer, contentType, finalUrl: parsed.toString() };
    }

    throw new BadRequestException('Too many redirects while fetching that link');
  }

  private async readCapped(response: Response): Promise<Buffer> {
    const reader = response.body?.getReader();
    if (!reader) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_FETCH_BYTES) {
        throw new BadRequestException('That link points to a file that is too large');
      }
      return buffer;
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_FETCH_BYTES) {
          await reader.cancel();
          throw new BadRequestException('That link points to a file that is too large');
        }
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks);
  }

  private parseHttpUrl(value: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only http/https links are supported');
    }
    return parsed;
  }

  private async assertPublicHost(hostname: string): Promise<void> {
    if (hostname.toLowerCase() === 'localhost') {
      throw new BadRequestException('That link is not reachable');
    }
    let address: string;
    try {
      address = (await lookup(hostname)).address;
    } catch {
      throw new BadRequestException('Could not resolve that link');
    }
    if (this.isPrivateIp(address)) {
      throw new BadRequestException('That link is not reachable');
    }
  }

  private isPrivateIp(address: string): boolean {
    if (net.isIPv4(address)) {
      const [a, b] = address.split('.').map(Number);
      if (a === 10 || a === 127 || a === 0) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT range
      return false;
    }
    if (net.isIPv6(address)) {
      const normalized = address.toLowerCase();
      if (normalized === '::1') return true;
      if (normalized.startsWith('fe80:')) return true; // link-local
      if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
      if (normalized.startsWith('::ffff:')) {
        const embeddedV4 = normalized.split(':').pop() ?? '';
        return net.isIPv4(embeddedV4) ? this.isPrivateIp(embeddedV4) : true;
      }
      return false;
    }
    return true; // unrecognized address format — reject rather than risk it
  }

  private extractOgImageUrl(html: string, pageUrl: string): string | null {
    for (const pattern of OG_IMAGE_PATTERNS) {
      const match = html.match(pattern);
      if (match?.[1]) {
        try {
          return new URL(match[1], pageUrl).toString();
        } catch {
          continue;
        }
      }
    }
    return null;
  }
}
