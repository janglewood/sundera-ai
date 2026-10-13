import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { FaqItemDto, PriceRowDto } from './create-blog-post.dto';

// blog-admin (apps/web) edits text content only — never slug, roomType,
// style, imageUrl, or sourceImageKey, which stay tied to the source collage
// this post was generated from.
export class UpdateBlogPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  dek?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageAlt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  problems?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(400)
  palette?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  materials?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  lighting?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PriceRowDto)
  priceTable?: PriceRowDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faq?: FaqItemDto[];
}
