import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

/**
 * Marks a route as reachable without a bearer token, but if one is present
 * it is still validated and `request.user` is populated. Used by routes
 * that behave differently for anonymous vs. authenticated callers (e.g.
 * POST /users, which is public self-registration but honors an ADMIN
 * caller's requested role).
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
