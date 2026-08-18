import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { extractBearerToken } from '../auth.utils';
import { FirebaseAdminService } from '../firebase-admin.service';

/**
 * Never blocks the request. A missing, invalid, or expired token silently
 * degrades to an anonymous request (`request.user` stays undefined) rather
 * than a 401 — these routes must stay usable without signing in.
 */
@Injectable()
export class OptionalFirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      return true;
    }

    try {
      const decoded = await this.firebaseAdmin.verifyIdToken(token);
      request.user = await this.authService.syncUser(decoded);
    } catch {
      // fall through anonymously
    }

    return true;
  }
}
