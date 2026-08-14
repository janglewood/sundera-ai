import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ROOM_TYPES, DESIGN_STYLES } from '@sundera/shared';

export class CreateGenerationDto {
  @IsString()
  roomPhotoId!: string;

  @IsIn(ROOM_TYPES)
  roomType!: (typeof ROOM_TYPES)[number];

  @IsIn(DESIGN_STYLES)
  style!: (typeof DESIGN_STYLES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customPrompt?: string;
}
