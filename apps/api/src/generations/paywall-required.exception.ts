import { HttpException, HttpStatus } from '@nestjs/common';

export class PaywallRequiredException extends HttpException {
  constructor(message: string) {
    super({ message, code: 'PAYWALL_REQUIRED' }, HttpStatus.PAYMENT_REQUIRED);
  }
}
