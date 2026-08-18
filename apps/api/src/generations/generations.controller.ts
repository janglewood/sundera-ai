import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { OptionalFirebaseAuthGuard } from '../auth/guards/optional-firebase-auth.guard';
import type { User } from '../../generated/prisma';
import { GenerationsService } from './generations.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { CreateEditGenerationDto } from './dto/create-edit-generation.dto';

@Controller('generations')
export class GenerationsController {
  constructor(private readonly generationsService: GenerationsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(OptionalFirebaseAuthGuard)
  create(@Body() dto: CreateGenerationDto, @CurrentUser() user?: User) {
    return this.generationsService.create(dto, user?.id);
  }

  @Get('mine')
  @UseGuards(FirebaseAuthGuard)
  listMine(@CurrentUser() user: User) {
    return this.generationsService.findByUser(user.id);
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
  @UseGuards(OptionalFirebaseAuthGuard)
  createEdit(
    @Param('id') id: string,
    @Body() dto: CreateEditGenerationDto,
    @CurrentUser() user?: User,
  ) {
    return this.generationsService.createEdit(id, dto, user?.id);
  }
}
