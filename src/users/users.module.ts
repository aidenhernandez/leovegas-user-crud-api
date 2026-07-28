import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { USERS_REPOSITORY } from './repositories/users-repository.interface';
import { TypeOrmUsersRepository } from './repositories/typeorm-users.repository';
import { USER_ACCESS_POLICY } from './policies/user-access-policy.interface';
import { UserAccessPolicy } from './policies/user-access.policy';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { HashingModule } from '../auth/hashing/hashing.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), HashingModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USERS_REPOSITORY,
      useClass: TypeOrmUsersRepository,
    },
    {
      provide: USER_ACCESS_POLICY,
      useClass: UserAccessPolicy,
    },
  ],
  exports: [USERS_REPOSITORY],
})
export class UsersModule {}
