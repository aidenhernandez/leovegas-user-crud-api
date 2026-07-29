import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainException } from '../exceptions/domain.exception';
import {
  JSON_API_CONTENT_TYPE,
  JsonApiErrorObject,
  JsonApiErrorResponse,
} from './jsonapi.types';

const DEFAULT_TITLES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

/**
 * Translates every thrown exception - domain exceptions, Nest's built-in
 * HttpExceptions (thrown by guards/pipes), or anything unexpected - into a
 * JSON:API `{ errors: [...] }` body. Adding a new DomainException subclass
 * never requires touching this file (OCP): it only needs a status/title/message.
 */
@Catch()
export class JsonApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, error } = this.toErrorObject(exception);

    response.status(status);
    response.setHeader('Content-Type', JSON_API_CONTENT_TYPE);
    response.json({ errors: [error] } satisfies JsonApiErrorResponse);
  }

  private toErrorObject(exception: unknown): {
    status: number;
    error: JsonApiErrorObject;
  } {
    if (exception instanceof DomainException) {
      return {
        status: exception.status,
        error: {
          status: String(exception.status),
          title: exception.title,
          detail: exception.message,
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        error: {
          status: String(status),
          title: DEFAULT_TITLES[status] ?? exception.name,
          detail: this.extractDetail(exception),
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: {
        status: String(HttpStatus.INTERNAL_SERVER_ERROR),
        title: DEFAULT_TITLES[HttpStatus.INTERNAL_SERVER_ERROR]!,
        detail: 'An unexpected error occurred',
      },
    };
  }

  private extractDetail(exception: HttpException): string {
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return body;
    }

    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = body.message;
      return Array.isArray(message) ? message.join(', ') : String(message);
    }

    return exception.message;
  }
}
