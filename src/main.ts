import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import 'dotenv/config';
import { AppModule } from './app.module';
import { writeFileSync } from 'fs'; 

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Increase body size limits to support large HTML content in posts
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ limit: '20mb', extended: true }));

  // serve uploaded files (images) from /uploads URL
  // In production, __dirname points to dist/
  // In development, __dirname points to src/
  const uploadsPath = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, 'data', 'uploads')
    : path.join(process.cwd(), 'src', 'data', 'uploads');
  app.useStaticAssets(uploadsPath, { prefix: '/uploads' });
  app.useStaticAssets(path.join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('NgPodium API')
    .setDescription('API documentation for NgPodium backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  writeFileSync('./swagger.json', JSON.stringify(document, null, 2));
  console.log('✅ Swagger JSON generated at ./swagger.json');

  await app.listen(3000);
  console.log('🚀 Application running on http://localhost:3000');
  console.log('📘 Swagger docs at http://localhost:3000/api');
}
bootstrap();
