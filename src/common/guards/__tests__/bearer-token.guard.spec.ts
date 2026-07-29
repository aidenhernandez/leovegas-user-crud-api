import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BearerTokenGuard } from '../bearer-token.guard';
import { AuthService } from '../../../auth/auth.service';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../../decorators/optional-auth.decorator';
import { buildUser } from '../../../test/fixtures/user.fixture';

interface FakeRequest {
  headers: Record<string, string>;
  user?: unknown;
}

function buildContext(authorizationHeader?: string): {
  context: ExecutionContext;
  request: FakeRequest;
} {
  const request: FakeRequest = {
    headers: authorizationHeader ? { authorization: authorizationHeader } : {},
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('BearerTokenGuard', () => {
  let authService: jest.Mocked<Pick<AuthService, 'validateToken'>>;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    authService = { validateToken: jest.fn() };
    reflector = { getAllAndOverride: jest.fn() };
  });

  function buildGuard(): BearerTokenGuard {
    return new BearerTokenGuard(
      authService as unknown as AuthService,
      reflector as unknown as Reflector,
    );
  }

  it('lets a @Public() route through without attempting token resolution', async () => {
    reflector.getAllAndOverride.mockImplementation(
      (key: string) => key === IS_PUBLIC_KEY,
    );
    const { context } = buildContext();

    await expect(buildGuard().canActivate(context)).resolves.toBe(true);
    expect(authService.validateToken).not.toHaveBeenCalled();
  });

  it('rejects a protected route with no token', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { context } = buildContext();

    await expect(buildGuard().canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches request.user for a protected route with a valid token', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const user = buildUser();
    authService.validateToken.mockResolvedValue(user);
    const { context, request } = buildContext('Bearer good-token');

    await expect(buildGuard().canActivate(context)).resolves.toBe(true);
    expect(authService.validateToken).toHaveBeenCalledWith('good-token');
    expect(request.user).toBe(user);
  });

  it('lets an @OptionalAuth() route through anonymously when no token is present', async () => {
    reflector.getAllAndOverride.mockImplementation(
      (key: string) => key === IS_OPTIONAL_AUTH_KEY,
    );
    const { context, request } = buildContext();

    await expect(buildGuard().canActivate(context)).resolves.toBe(true);
    expect(authService.validateToken).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('still validates the token on an @OptionalAuth() route when one is present', async () => {
    reflector.getAllAndOverride.mockImplementation(
      (key: string) => key === IS_OPTIONAL_AUTH_KEY,
    );
    const user = buildUser();
    authService.validateToken.mockResolvedValue(user);
    const { context, request } = buildContext('Bearer good-token');

    await expect(buildGuard().canActivate(context)).resolves.toBe(true);
    expect(request.user).toBe(user);
  });

  it('rejects an @OptionalAuth() route when an invalid token is present', async () => {
    reflector.getAllAndOverride.mockImplementation(
      (key: string) => key === IS_OPTIONAL_AUTH_KEY,
    );
    authService.validateToken.mockRejectedValue(
      new UnauthorizedException('Invalid or expired access token'),
    );
    const { context } = buildContext('Bearer bad-token');

    await expect(buildGuard().canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
