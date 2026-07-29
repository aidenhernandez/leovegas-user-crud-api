import { Inject, Injectable } from '@nestjs/common';
import { User } from './entities/user.entity';
import { Role } from './entities/role.enum';
import { USERS_REPOSITORY } from './repositories/users-repository.interface';
import type { IUsersRepository } from './repositories/users-repository.interface';
import { USER_ACCESS_POLICY } from './policies/user-access-policy.interface';
import type { IUserAccessPolicy } from './policies/user-access-policy.interface';
import { PASSWORD_HASHER } from '../auth/hashing/password-hasher.interface';
import type { IPasswordHasher } from '../auth/hashing/password-hasher.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ForbiddenActionException } from '../common/exceptions/forbidden-action.exception';
import { UserNotFoundException } from '../common/exceptions/user-not-found.exception';
import { DuplicateEmailException } from '../common/exceptions/duplicate-email.exception';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
    @Inject(USER_ACCESS_POLICY)
    private readonly accessPolicy: IUserAccessPolicy,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
  ) {}

  async create(dto: CreateUserDto, requester?: User): Promise<User> {
    const emailTaken = await this.usersRepository.existsByEmail(dto.email);
    if (emailTaken) {
      throw new DuplicateEmailException(dto.email);
    }

    const role =
      requester?.role === Role.ADMIN && dto.role ? dto.role : Role.USER;
    const passwordHash = await this.passwordHasher.hash(dto.password);
    return this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role,
    });
  }

  async findAll(requester: User): Promise<User[]> {
    if (!this.accessPolicy.canList(requester)) {
      throw new ForbiddenActionException('Only administrators can list users');
    }
    return this.usersRepository.findAll();
  }

  async findOne(requester: User, targetId: string): Promise<User> {
    if (!this.accessPolicy.canView(requester, targetId)) {
      throw new ForbiddenActionException(
        'You may only view your own user record',
      );
    }

    const user = await this.usersRepository.findById(targetId);
    if (!user) {
      throw new UserNotFoundException(targetId);
    }
    return user;
  }

  async update(
    requester: User,
    targetId: string,
    dto: UpdateUserDto,
  ): Promise<User> {
    const isRoleChange = dto.role !== undefined;
    if (!this.accessPolicy.canUpdate(requester, targetId, isRoleChange)) {
      throw new ForbiddenActionException(
        'You are not allowed to update this user',
      );
    }

    const existing = await this.usersRepository.findById(targetId);
    if (!existing) {
      throw new UserNotFoundException(targetId);
    }

    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.usersRepository.existsByEmail(dto.email);
      if (emailTaken) {
        throw new DuplicateEmailException(dto.email);
      }
    }

    const passwordHash = dto.password
      ? await this.passwordHasher.hash(dto.password)
      : undefined;

    return this.usersRepository.update(targetId, {
      name: dto.name,
      email: dto.email,
      role: dto.role,
      passwordHash,
    });
  }

  async remove(requester: User, targetId: string): Promise<void> {
    if (!this.accessPolicy.canDelete(requester, targetId)) {
      throw new ForbiddenActionException(
        'You are not allowed to delete this user',
      );
    }

    const existing = await this.usersRepository.findById(targetId);
    if (!existing) {
      throw new UserNotFoundException(targetId);
    }

    await this.usersRepository.delete(targetId);
  }
}
