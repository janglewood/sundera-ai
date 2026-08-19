import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CreateInvoiceV3Request,
  InvoicePaymentParamsResponse,
} from './types/lava-top-api.types';

@Injectable()
export class LavaTopClientService {
  private readonly logger = new Logger(LavaTopClientService.name);
  // Read lazily (not getOrThrow at construction) so the rest of the API
  // still boots before lava.top is fully configured on the dashboard —
  // only checkout/cancel calls fail until LAVA_TOP_API_KEY is set.
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LAVA_TOP_API_KEY');
    this.baseUrl =
      this.configService.get<string>('LAVA_TOP_BASE_URL') ??
      'https://gate.lava.top';
  }

  private requireApiKey(): string {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'Payments are not configured yet (missing LAVA_TOP_API_KEY).',
      );
    }
    return this.apiKey;
  }

  async createInvoice(
    request: CreateInvoiceV3Request,
  ): Promise<InvoicePaymentParamsResponse> {
    const apiKey = this.requireApiKey();
    const response = await fetch(`${this.baseUrl}/api/v3/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `lava.top invoice creation failed (${response.status}): ${body}`,
      );
      throw new InternalServerErrorException(
        'Failed to start checkout with the payment provider.',
      );
    }

    return response.json() as Promise<InvoicePaymentParamsResponse>;
  }

  async cancelSubscription(contractId: string, email: string): Promise<void> {
    const apiKey = this.requireApiKey();
    const url = new URL(`${this.baseUrl}/api/v1/subscriptions`);
    url.searchParams.set('contractId', contractId);
    url.searchParams.set('email', email);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'X-Api-Key': apiKey },
    });

    if (!response.ok && response.status !== 204) {
      const body = await response.text();
      this.logger.error(
        `lava.top subscription cancellation failed (${response.status}): ${body}`,
      );
      throw new InternalServerErrorException(
        'Failed to cancel the subscription with the payment provider.',
      );
    }
  }
}
