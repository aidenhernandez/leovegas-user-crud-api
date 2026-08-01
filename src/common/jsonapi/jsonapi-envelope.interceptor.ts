import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { Response } from 'express';
import { JSON_API_CONTENT_TYPE } from './jsonapi.types';

function isPreBuiltEnvelope(payload: unknown): payload is { data: unknown } {
  return (
    payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    'data' in payload
  );
}

/**
 * Wraps a controller's return value in a top-level `data` member and sets the
 * JSON:API content type. Resource-agnostic on purpose: controllers are
 * responsible for producing already-serialized resource object(s) (see
 * IResourceSerializer); this interceptor never needs to change when a new
 * resource type is added (OCP). A controller that needs extra top-level
 * members alongside `data` (e.g. pagination `meta`) can pre-build the whole
 * envelope itself - `{ data, meta }` is passed through unchanged rather than
 * wrapped a second time.
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
        if (isPreBuiltEnvelope(payload)) {
          return payload;
        }
        return { data: payload };
      }),
    );
  }
}
