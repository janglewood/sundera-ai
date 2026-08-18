import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import type { User } from '../../generated/prisma';

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  getMe(@CurrentUser() user: User) {
    return user;
  }
}
