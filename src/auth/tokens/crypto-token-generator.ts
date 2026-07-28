import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ITokenGenerator } from './token-generator.interface';

@Injectable()
export class CryptoTokenGenerator implements ITokenGenerator {
  generate(): string {
    return randomBytes(32).toString('hex');
  }
}
