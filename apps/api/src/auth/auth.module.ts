import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import { OptionalFirebaseAuthGuard } from './guards/optional-firebase-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [
    FirebaseAdminService,
    AuthService,
    FirebaseAuthGuard,
    OptionalFirebaseAuthGuard,
  ],
  exports: [
    FirebaseAdminService,
    AuthService,
    FirebaseAuthGuard,
    OptionalFirebaseAuthGuard,
  ],
})
export class AuthModule {}
