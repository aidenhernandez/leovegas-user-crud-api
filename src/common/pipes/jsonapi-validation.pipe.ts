import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { ValidationException } from '../exceptions/validation.exception';
import { JsonApiErrorObject } from '../jsonapi/jsonapi.types';

const UNPROCESSABLE_ENTITY = String(HttpStatus.UNPROCESSABLE_ENTITY);

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): JsonApiErrorObject[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.children && error.children.length > 0) {
      return flattenValidationErrors(error.children, path);
    }

    const messages = error.constraints
      ? Object.values(error.constraints)
      : ['Validation failed'];

    return messages.map((detail) => ({
      status: UNPROCESSABLE_ENTITY,
      title: 'Unprocessable Entity',
      detail,
      source: { pointer: `/${path}` },
    }));
  });
}

/**
 * Global validation pipe producing JSON:API-shaped 422 errors instead of
 * Nest's default `{statusCode, message: string[]}`. whitelist+
 * forbidNonWhitelisted reject unknown body fields rather than silently
 * dropping them - stricter, and it surfaces client mistakes as errors
 * instead of swallowing them.
 */
export class JsonApiValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new ValidationException(flattenValidationErrors(errors)),
    });
  }
}
