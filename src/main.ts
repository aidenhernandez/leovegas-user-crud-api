import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';
import { normalizeJsonApiContentType } from './common/content-negotiation.middleware';
import { JsonApiExceptionFilter } from './common/jsonapi/jsonapi-exception.filter';
import { JsonApiValidationPipe } from './common/pipes/jsonapi-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(normalizeJsonApiContentType);
  app.use(json());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new JsonApiExceptionFilter());
  app.useGlobalPipes(new JsonApiValidationPipe());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
