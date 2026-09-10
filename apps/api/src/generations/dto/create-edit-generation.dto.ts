import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class MaskPointDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  y!: number;
}

class RegionMaskDto {
  @IsIn(['freehand', 'rectangle'])
  shape!: 'freehand' | 'rectangle';

  @ValidateNested({ each: true })
  @Type(() => MaskPointDto)
  @ArrayMinSize(3)
  points!: MaskPointDto[];
}

export class CreateEditGenerationDto {
  @IsString()
  sourceResultId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  prompt!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegionMaskDto)
  regionMask?: RegionMaskDto;
}
