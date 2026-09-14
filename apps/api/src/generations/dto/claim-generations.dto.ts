import { ArrayMaxSize, ArrayNotEmpty, IsString } from 'class-validator';

export class ClaimGenerationsDto {
  @IsString({ each: true })
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  generationIds!: string[];
}
