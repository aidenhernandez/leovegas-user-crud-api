import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';
import { normalizeJsonApiContentType } from './common/content-negotiation.middleware';
import { JsonApiExceptionFilter } from './common/jsonapi/jsonapi-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(normalizeJsonApiContentType);
  app.use(json());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new JsonApiExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
