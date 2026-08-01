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

  canUpdate(
    requester: User,
    targetId: string,
    isRoleChange: boolean,
    wouldRemoveLastAdmin: boolean,
  ): boolean {
    if (isRoleChange && requester.role !== Role.ADMIN) {
      return false;
    }
    // wouldRemoveLastAdmin is a fact the caller derived from the database
    // (whether targetId is currently the sole ADMIN and this change would
    // move them off ADMIN) - this class stays DB-agnostic and just applies
    // the rule: never allow a role change that leaves zero admins.
    if (isRoleChange && wouldRemoveLastAdmin) {
      return false;
    }
    return requester.role === Role.ADMIN || requester.id === targetId;
  }

  canDelete(requester: User, targetId: string): boolean {
    return requester.role === Role.ADMIN && requester.id !== targetId;
  }
}
