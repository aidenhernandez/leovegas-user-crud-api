import { UserAccessPolicy } from '../user-access.policy';
import { Role } from '../../entities/role.enum';
import { buildUser } from '../../../test/fixtures/user.fixture';

describe('UserAccessPolicy', () => {
  const policy = new UserAccessPolicy();

  describe('canView', () => {
    it('allows an ADMIN to view any user', () => {
      const admin = buildUser({ id: 'admin-1', role: Role.ADMIN });
      expect(policy.canView(admin, 'user-2')).toBe(true);
    });

    it('allows a USER to view their own record', () => {
      const user = buildUser({ id: 'user-1', role: Role.USER });
      expect(policy.canView(user, 'user-1')).toBe(true);
    });

    it('forbids a USER from viewing another user record', () => {
      const user = buildUser({ id: 'user-1', role: Role.USER });
      expect(policy.canView(user, 'user-2')).toBe(false);
    });
  });

  describe('canList', () => {
    it('allows an ADMIN to list', () => {
      expect(policy.canList(buildUser({ role: Role.ADMIN }))).toBe(true);
    });

    it('forbids a USER from listing', () => {
      expect(policy.canList(buildUser({ role: Role.USER }))).toBe(false);
    });
  });

  describe('canUpdate', () => {
    it('allows a USER to update their own non-role fields', () => {
      const user = buildUser({ id: 'user-1', role: Role.USER });
      expect(policy.canUpdate(user, 'user-1', false)).toBe(true);
    });

    it('forbids a USER from changing their own role', () => {
      const user = buildUser({ id: 'user-1', role: Role.USER });
      expect(policy.canUpdate(user, 'user-1', true)).toBe(false);
    });

    it('forbids a USER from updating another user, role change or not', () => {
      const user = buildUser({ id: 'user-1', role: Role.USER });
      expect(policy.canUpdate(user, 'user-2', false)).toBe(false);
      expect(policy.canUpdate(user, 'user-2', true)).toBe(false);
    });

    it('allows an ADMIN to update another user, including their role', () => {
      const admin = buildUser({ id: 'admin-1', role: Role.ADMIN });
      expect(policy.canUpdate(admin, 'user-2', true)).toBe(true);
    });

    it('allows an ADMIN to change their own role (documented judgment call: the spec only restricts USER here)', () => {
      const admin = buildUser({ id: 'admin-1', role: Role.ADMIN });
      expect(policy.canUpdate(admin, 'admin-1', true)).toBe(true);
    });
  });

  describe('canDelete', () => {
    it('allows an ADMIN to delete another user', () => {
      const admin = buildUser({ id: 'admin-1', role: Role.ADMIN });
      expect(policy.canDelete(admin, 'user-2')).toBe(true);
    });

    it('forbids an ADMIN from deleting themselves', () => {
      const admin = buildUser({ id: 'admin-1', role: Role.ADMIN });
      expect(policy.canDelete(admin, 'admin-1')).toBe(false);
    });

    it('forbids a USER from deleting anyone, including themselves', () => {
      const user = buildUser({ id: 'user-1', role: Role.USER });
      expect(policy.canDelete(user, 'user-1')).toBe(false);
      expect(policy.canDelete(user, 'user-2')).toBe(false);
    });
  });
});
