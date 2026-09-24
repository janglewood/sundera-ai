import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { User } from '../../generated/prisma';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(FirebaseAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  createCheckout(@CurrentUser() user: User) {
    return this.paymentsService.createCheckout(user);
  }

  @Get('purchase')
  getMyPurchase(@CurrentUser() user: User) {
    return this.paymentsService.getMyPurchase(user.id);
  }
}
