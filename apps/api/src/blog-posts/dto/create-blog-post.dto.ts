import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ROOM_TYPES, DESIGN_STYLES } from '@sundera/shared';

export class PriceRowDto {
  @IsString()
  @MaxLength(60)
  item!: string;

  @IsString()
  @MaxLength(40)
  budget!: string;

  @IsString()
  @MaxLength(40)
  mid!: string;
}

export class FaqItemDto {
  @IsString()
  @MaxLength(200)
  question!: string;

  @IsString()
  @MaxLength(600)
  answer!: string;
}

export class CreateBlogPostDto {
  @IsString()
  @MaxLength(100)
  slug!: string;

  @IsString()
  @MaxLength(150)
  title!: string;

  @IsString()
  @MaxLength(300)
  dek!: string;

  @IsIn(ROOM_TYPES)
  roomType!: (typeof ROOM_TYPES)[number];

  @IsIn(DESIGN_STYLES)
  style!: (typeof DESIGN_STYLES)[number];

  @IsString()
  imageUrl!: string;

  @IsString()
  @MaxLength(300)
  imageAlt!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  problems!: string[];

  @IsString()
  @MaxLength(400)
  palette!: string;

  @IsString()
  @MaxLength(400)
  materials!: string;

  @IsString()
  @MaxLength(400)
  lighting!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PriceRowDto)
  priceTable!: PriceRowDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faq!: FaqItemDto[];

  @IsString()
  @MaxLength(300)
  sourceImageKey!: string;
}
