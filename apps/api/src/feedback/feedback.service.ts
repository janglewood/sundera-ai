import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  // Read lazily (not getOrThrow at construction) so the rest of the API
  // still boots before Gmail SMTP is configured — only feedback
  // submissions fail until GMAIL_USER/GMAIL_APP_PASSWORD are set.
  private readonly transporter?: Transporter;
  private readonly gmailUser?: string;
  private readonly toEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.gmailUser = this.configService.get<string>('GMAIL_USER');
    const appPassword = this.configService.get<string>('GMAIL_APP_PASSWORD');
    this.toEmail =
      this.configService.get<string>('FEEDBACK_TO_EMAIL') ?? 'info@sundera.app';

    if (this.gmailUser && appPassword) {
      this.transporter = createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: this.gmailUser, pass: appPassword },
      });
    }
  }

  async send(email: string, message: string): Promise<void> {
    if (!this.transporter || !this.gmailUser) {
      throw new ServiceUnavailableException(
        'Feedback is not configured yet (missing GMAIL_USER/GMAIL_APP_PASSWORD).',
      );
    }

    try {
      // From must be the authenticated Gmail address — Gmail's SMTP
      // rejects/spoofs anything else. replyTo carries the sender's own
      // address so replying in an inbox reaches them directly.
      await this.transporter.sendMail({
        from: `Sundera Feedback <${this.gmailUser}>`,
        to: this.toEmail,
        replyTo: email,
        subject: 'New feedback from Sundera',
        text: `From: ${email}\n\n${message}`,
      });
    } catch (err) {
      this.logger.error('Gmail SMTP feedback email failed', err);
      throw new InternalServerErrorException('Failed to send feedback.');
    }
  }
}
