import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameGenerationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title!: string;
}
