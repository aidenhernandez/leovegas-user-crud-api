import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.enum';
import { DuplicateEmailException } from '../../common/exceptions/duplicate-email.exception';
import {
  CreateUserData,
  IUsersRepository,
  UpdateUserData,
} from './users-repository.interface';

const MYSQL_DUPLICATE_ENTRY_CODE = 'ER_DUP_ENTRY';

@Injectable()
export class TypeOrmUsersRepository implements IUsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email });
  }

  findByEmailWithCredentials(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  findByAccessToken(accessToken: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.accessToken')
      .where('user.accessToken = :accessToken', { accessToken })
      .getOne();
  }

  findAll(): Promise<User[]> {
    return this.repository.find();
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.repository.countBy({ email });
    return count > 0;
  }

  countByRole(role: Role): Promise<number> {
    return this.repository.countBy({ role });
  }

  async create(data: CreateUserData): Promise<User> {
    const user = this.repository.create({
      name: data.name,
      email: data.email,
      password: data.passwordHash,
      role: data.role,
      accessToken: null,
    });
    try {
      await this.repository.save(user);
    } catch (error) {
      // accessToken is always null on create (and MySQL permits multiple NULLs
      // in a unique index), so a duplicate-entry error here can only be the
      // email index - a concurrent request winning the race against the
      // service layer's existsByEmail pre-check.
      throw this.translateDuplicateEntryError(error, data.email);
    }
    const created = await this.findById(user.id);
    if (!created) {
      throw new Error(`User ${user.id} disappeared immediately after creation`);
    }
    return created;
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    try {
      await this.repository.update(id, {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.passwordHash !== undefined && { password: data.passwordHash }),
        ...(data.role !== undefined && { role: data.role }),
      });
    } catch (error) {
      // update() never touches accessToken (that's updateAccessToken()'s job),
      // so the only unique column it can collide on is email.
      throw this.translateDuplicateEntryError(error, data.email);
    }
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`User ${id} disappeared during update`);
    }
    return updated;
  }

  private translateDuplicateEntryError(
    error: unknown,
    email?: string,
  ): unknown {
    const isDuplicateEntry =
      error instanceof QueryFailedError &&
      (error as unknown as { code?: string }).code ===
        MYSQL_DUPLICATE_ENTRY_CODE;
    return isDuplicateEntry ? new DuplicateEmailException(email ?? '') : error;
  }

  async updateAccessToken(id: string, accessToken: string): Promise<void> {
    await this.repository.update(id, { accessToken });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
