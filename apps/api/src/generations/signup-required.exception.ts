import { HttpException, HttpStatus } from '@nestjs/common';

export class SignUpRequiredException extends HttpException {
  constructor(message: string) {
    super({ message, code: 'SIGNUP_REQUIRED' }, HttpStatus.UNAUTHORIZED);
  }
}
