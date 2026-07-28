import { User } from '../entities/user.entity';
import { Role } from '../entities/role.enum';
import { IUserAccessPolicy } from './user-access-policy.interface';

/**
 * Single source of truth for who can view/list/update/delete which users.
 * Deliberately framework-agnostic (no Nest imports) so it's testable as a
 * plain class with zero mocks.
 */
export class UserAccessPolicy implements IUserAccessPolicy {
  canView(requester: User, targetId: string): boolean {
    return requester.role === Role.ADMIN || requester.id === targetId;
  }

  canList(requester: User): boolean {
    return requester.role === Role.ADMIN;
  }

  canUpdate(requester: User, targetId: string, isRoleChange: boolean): boolean {
    if (isRoleChange && requester.role !== Role.ADMIN) {
      return false;
    }
    return requester.role === Role.ADMIN || requester.id === targetId;
  }

  canDelete(requester: User, targetId: string): boolean {
    return requester.role === Role.ADMIN && requester.id !== targetId;
  }
}
