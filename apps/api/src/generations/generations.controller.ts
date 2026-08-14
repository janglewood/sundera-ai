import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { GenerationsService } from './generations.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { CreateEditGenerationDto } from './dto/create-edit-generation.dto';

@Controller('generations')
export class GenerationsController {
  constructor(private readonly generationsService: GenerationsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() dto: CreateGenerationDto) {
    return this.generationsService.create(dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.generationsService.getById(id);
  }

  @Post(':id/edit')
  @HttpCode(HttpStatus.ACCEPTED)
  createEdit(@Param('id') id: string, @Body() dto: CreateEditGenerationDto) {
    return this.generationsService.createEdit(id, dto);
  }
}
