import { User } from '../entities/user.entity';

export const USER_ACCESS_POLICY = Symbol('USER_ACCESS_POLICY');

/**
 * Fine-grained "self vs. other" authorization rules, independent of the
 * coarse role gating done by RolesGuard. Narrow on purpose (ISP): callers
 * depend only on the check they actually need.
 */
export interface IUserAccessPolicy {
  canView(requester: User, targetId: string): boolean;
  canList(requester: User): boolean;
  canUpdate(
    requester: User,
    targetId: string,
    isRoleChange: boolean,
    wouldRemoveLastAdmin: boolean,
  ): boolean;
  canDelete(requester: User, targetId: string): boolean;
}
