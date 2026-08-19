import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { User } from '../../generated/prisma';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(FirebaseAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  createCheckout(@CurrentUser() user: User, @Body() dto: CreateCheckoutDto) {
    return this.paymentsService.createCheckout(
      user,
      dto.planTier,
      dto.periodicity,
    );
  }

  @Get('subscription')
  getMySubscription(@CurrentUser() user: User) {
    return this.paymentsService.getMySubscription(user.id);
  }

  @Delete('subscription')
  cancelMySubscription(@CurrentUser() user: User) {
    return this.paymentsService.cancelMySubscription(user);
  }
}
