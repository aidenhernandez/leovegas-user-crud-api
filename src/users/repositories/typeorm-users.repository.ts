import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import {
  CreateUserData,
  IUsersRepository,
  UpdateUserData,
} from './users-repository.interface';

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

  async create(data: CreateUserData): Promise<User> {
    const user = this.repository.create({
      name: data.name,
      email: data.email,
      password: data.passwordHash,
      role: data.role,
      accessToken: null,
    });
    return this.repository.save(user);
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    await this.repository.update(id, {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.passwordHash !== undefined && { password: data.passwordHash }),
      ...(data.role !== undefined && { role: data.role }),
    });
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`User ${id} disappeared during update`);
    }
    return updated;
  }

  async updateAccessToken(id: string, accessToken: string): Promise<void> {
    await this.repository.update(id, { accessToken });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
