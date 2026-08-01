import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('leovegas-user-api')
    .setDescription(
      'RESTful CRUD API for a User resource, with role-based authorization ' +
        'and JSON:API-shaped responses. Request/response bodies shown here ' +
        'reflect the DTOs; actual responses are wrapped in a JSON:API ' +
        '`{ data, errors, meta }` envelope - see the README and ' +
        'docs/API_TESTING.md for full response shapes.',
    )
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      description: 'Opaque access token returned by POST /auth/login',
    })
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
