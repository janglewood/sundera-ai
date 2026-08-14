import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateEditGenerationDto {
  @IsString()
  sourceResultId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  prompt!: string;
}
