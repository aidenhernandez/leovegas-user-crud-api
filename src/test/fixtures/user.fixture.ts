import { Role } from '../../users/entities/role.enum';
import { User } from '../../users/entities/user.entity';

/**
 * Shared plain-object User builder for specs. Centralized because several
 * unrelated spec files (policy, service, controller, auth) need a User
 * shaped exactly like the entity - one place to update if the entity shape
 * changes. Not itself a spec, so it lives outside any __tests__ folder.
 */
export function buildUser(overrides: Partial<User> = {}): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const user = new User();
  return Object.assign(user, {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed-password',
    role: Role.USER,
    accessToken: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}
