import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { RenameGenerationDto } from './dto/rename-generation.dto';

@Controller('generations')
export class GenerationsController {
  constructor(private readonly generationsService: GenerationsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(FirebaseAuthGuard)
  create(@Body() dto: CreateGenerationDto, @CurrentUser() user: User) {
    return this.generationsService.create(dto, user.id);
  }

  @Get('mine')
  @UseGuards(FirebaseAuthGuard)
  listMine(@CurrentUser() user: User) {
    return this.generationsService.findByUser(user.id);
  }

  @Get(':id')
  @UseGuards(OptionalFirebaseAuthGuard)
  getById(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.generationsService.getById(id, user?.id);
  }

  @Patch(':id/title')
  @UseGuards(OptionalFirebaseAuthGuard)
  renameGeneration(
    @Param('id') id: string,
    @Body() dto: RenameGenerationDto,
    @CurrentUser() user?: User,
  ) {
    return this.generationsService.renameGeneration(id, dto.title, user?.id);
  }

  @Get(':id/results/:resultId/download')
  @UseGuards(OptionalFirebaseAuthGuard)
  async downloadResult(
    @Param('id') id: string,
    @Param('resultId') resultId: string,
    @Res() res: Response,
    @CurrentUser() user?: User,
  ) {
    const { buffer, contentType, filename } =
      await this.generationsService.getResultFile(id, resultId, user?.id);
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
