import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../roles.guard';
import { Role } from '../../../users/entities/role.enum';
import { User } from '../../../users/entities/user.entity';
import { buildUser } from '../../../test/fixtures/user.fixture';

function buildContext(user?: User): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function buildReflector(requiredRoles: Role[] | undefined): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('allows the request through when no roles are required', () => {
    const guard = new RolesGuard(buildReflector(undefined));

    expect(guard.canActivate(buildContext(buildUser()))).toBe(true);
  });

  it('allows a requester whose role is in the required list', () => {
    const guard = new RolesGuard(buildReflector([Role.ADMIN]));

    expect(
      guard.canActivate(buildContext(buildUser({ role: Role.ADMIN }))),
    ).toBe(true);
  });

  it('throws ForbiddenException when the requester role is not in the required list', () => {
    const guard = new RolesGuard(buildReflector([Role.ADMIN]));

    expect(() =>
      guard.canActivate(buildContext(buildUser({ role: Role.USER }))),
    ).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no authenticated requester at all', () => {
    const guard = new RolesGuard(buildReflector([Role.ADMIN]));

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
