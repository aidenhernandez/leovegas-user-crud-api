import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { Response } from 'express';
import { JSON_API_CONTENT_TYPE } from './jsonapi.types';

/**
 * Wraps a controller's return value in a top-level `data` member and sets the
 * JSON:API content type. Resource-agnostic on purpose: controllers are
 * responsible for producing already-serialized resource object(s) (see
 * IResourceSerializer); this interceptor never needs to change when a new
 * resource type is added (OCP).
 */
@Injectable()
export class JsonApiEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Content-Type', JSON_API_CONTENT_TYPE);

    return next.handle().pipe(
      map((payload: unknown) => {
        if (payload === undefined) {
          return payload;
        }
        return { data: payload };
      }),
    );
  }
}
