import { Injectable } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  syncUser(decoded: DecodedIdToken) {
    const data = {
      email: decoded.email ?? null,
      emailVerified: decoded.email_verified ?? false,
      displayName: (decoded.name as string | undefined) ?? null,
      photoURL: decoded.picture ?? null,
      provider: decoded.firebase.sign_in_provider,
    };

    return this.prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: data,
      create: { firebaseUid: decoded.uid, ...data },
    });
  }
}
