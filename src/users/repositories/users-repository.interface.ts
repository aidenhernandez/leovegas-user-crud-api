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

export interface PaginationParams {
  skip: number;
  take: number;
}

export interface PaginatedUsers {
  items: User[];
  totalCount: number;
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
  findAll(pagination: PaginationParams): Promise<PaginatedUsers>;
  existsByEmail(email: string): Promise<boolean>;
  countByRole(role: Role): Promise<number>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
  setAccessToken(
    id: string,
    accessToken: string,
    expiresAt: Date,
  ): Promise<void>;
  clearAccessToken(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}
