import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
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

  @Get(':id/results/:resultId/download')
  async downloadResult(
    @Param('id') id: string,
    @Param('resultId') resultId: string,
    @Res() res: Response,
  ) {
    const { buffer, contentType, filename } =
      await this.generationsService.getResultFile(id, resultId);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post(':id/edit')
  @HttpCode(HttpStatus.ACCEPTED)
  createEdit(@Param('id') id: string, @Body() dto: CreateEditGenerationDto) {
    return this.generationsService.createEdit(id, dto);
  }
}
