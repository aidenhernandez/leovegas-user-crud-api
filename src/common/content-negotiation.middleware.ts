import type { NextFunction, Request, Response } from 'express';
import { JSON_API_CONTENT_TYPE } from './jsonapi/jsonapi.types';

/**
 * Express's JSON body parser only recognizes `application/json` by default.
 * JSON:API clients are expected to send `application/vnd.api+json`, so this
 * normalizes that media type before the body parser runs, letting spec-correct
 * clients still get their request body parsed.
 */
export function normalizeJsonApiContentType(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const contentType = req.headers['content-type'];
  if (contentType?.startsWith(JSON_API_CONTENT_TYPE)) {
    req.headers['content-type'] = 'application/json';
  }
  next();
}
