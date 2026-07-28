import { User } from '../entities/user.entity';
import { Role } from '../entities/role.enum';

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  passwordHash?: string;
  role?: Role;
}

/**
 * Narrow persistence contract for the User aggregate. Deliberately excludes
 * the raw TypeORM Repository/QueryBuilder API (ISP) so callers only depend
 * on the handful of operations the domain actually needs.
 */
export interface IUsersRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailWithCredentials(email: string): Promise<User | null>;
  findByAccessToken(accessToken: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  existsByEmail(email: string): Promise<boolean>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
  updateAccessToken(id: string, accessToken: string): Promise<void>;
  delete(id: string): Promise<void>;
}
