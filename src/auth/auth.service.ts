import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { USERS_REPOSITORY } from '../users/repositories/users-repository.interface';
import type { IUsersRepository } from '../users/repositories/users-repository.interface';
import { PASSWORD_HASHER } from './hashing/password-hasher.interface';
import type { IPasswordHasher } from './hashing/password-hasher.interface';
import { TOKEN_GENERATOR } from './tokens/token-generator.interface';
import type { ITokenGenerator } from './tokens/token-generator.interface';

export interface LoginResult {
  user: User;
  accessToken: string;
}

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: IUsersRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: ITokenGenerator,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.usersRepository.findByEmailWithCredentials(email);
    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await this.passwordHasher.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const accessToken = this.tokenGenerator.generate();
    await this.usersRepository.updateAccessToken(user.id, accessToken);

    const { password: _password, ...userWithoutPassword } = user;
    return { user: userWithoutPassword as User, accessToken };
  }

  async validateToken(accessToken: string): Promise<User> {
    const user = await this.usersRepository.findByAccessToken(accessToken);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    return user;
  }
}
