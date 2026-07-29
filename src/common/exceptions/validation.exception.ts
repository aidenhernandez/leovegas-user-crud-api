import { HttpException, HttpStatus } from '@nestjs/common';
import { JsonApiErrorObject } from '../jsonapi/jsonapi.types';

/**
 * Carries one or more field-level JSON:API error objects (each with a
 * source.pointer) instead of the single message Nest's HttpException
 * normally holds. Thrown only by JsonApiValidationPipe's exceptionFactory;
 * JsonApiExceptionFilter special-cases it to emit all of them at once
 * instead of collapsing to one error.
 */
export class ValidationException extends HttpException {
  constructor(public readonly errors: JsonApiErrorObject[]) {
    super({ errors }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
