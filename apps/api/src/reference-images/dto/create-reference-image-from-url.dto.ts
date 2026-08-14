import { IsUrl } from 'class-validator';

export class CreateReferenceImageFromUrlDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;
}
