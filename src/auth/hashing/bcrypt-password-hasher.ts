import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { IPasswordHasher } from './password-hasher.interface';

@Injectable()
export class BcryptPasswordHasher implements IPasswordHasher {
  constructor(private readonly configService: ConfigService) {}

  hash(plain: string): Promise<string> {
    const saltRounds = this.configService.get<number>('bcryptSaltRounds') ?? 10;
    return bcrypt.hash(plain, saltRounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
