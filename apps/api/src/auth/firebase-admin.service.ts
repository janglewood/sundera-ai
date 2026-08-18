import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private app!: App;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.app = initializeApp({
      credential: cert({
        projectId: this.configService.getOrThrow<string>('FIREBASE_PROJECT_ID'),
        clientEmail: this.configService.getOrThrow<string>(
          'FIREBASE_CLIENT_EMAIL',
        ),
        privateKey: this.configService
          .getOrThrow<string>('FIREBASE_PRIVATE_KEY')
          .replace(/\\n/g, '\n'),
      }),
    });
  }

  verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return getAuth(this.app).verifyIdToken(idToken);
  }
}
