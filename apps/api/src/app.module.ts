import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { UploadsModule } from './uploads/uploads.module';
import { ReferenceImagesModule } from './reference-images/reference-images.module';
import { GenerationsModule } from './generations/generations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    UploadsModule,
    ReferenceImagesModule,
    GenerationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
