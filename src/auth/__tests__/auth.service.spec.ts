import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { IUsersRepository } from '../../users/repositories/users-repository.interface';
import { IPasswordHasher } from '../hashing/password-hasher.interface';
import { ITokenGenerator } from '../tokens/token-generator.interface';
import { buildUser } from '../../test/fixtures/user.fixture';

describe('AuthService', () => {
  let service: AuthService;
  let repository: jest.Mocked<IUsersRepository>;
  let passwordHasher: jest.Mocked<IPasswordHasher>;
  let tokenGenerator: jest.Mocked<ITokenGenerator>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailWithCredentials: jest.fn(),
      findByAccessToken: jest.fn(),
      findAll: jest.fn(),
      existsByEmail: jest.fn(),
      countByRole: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setAccessToken: jest.fn(),
      clearAccessToken: jest.fn(),
      delete: jest.fn(),
    };
    passwordHasher = { hash: jest.fn(), compare: jest.fn() };
    tokenGenerator = { generate: jest.fn() };
    configService = { get: jest.fn().mockReturnValue(3600) };

    service = new AuthService(
      repository,
      passwordHasher,
      tokenGenerator,
      configService as unknown as ConfigService,
    );
  });

  describe('login', () => {
    it('rejects an unknown email without attempting a password comparison', async () => {
      repository.findByEmailWithCredentials.mockResolvedValue(null);

      await expect(
        service.login('missing@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
      expect(passwordHasher.compare).not.toHaveBeenCalled();
    });

    it('rejects a wrong password without generating a token', async () => {
      repository.findByEmailWithCredentials.mockResolvedValue(buildUser());
      passwordHasher.compare.mockResolvedValue(false);

      await expect(
        service.login('test@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(tokenGenerator.generate).not.toHaveBeenCalled();
    });

    it('issues and persists a new token with an expiry, and strips the password hash from the result', async () => {
      const user = buildUser({ password: 'stored-hash' });
      repository.findByEmailWithCredentials.mockResolvedValue(user);
      passwordHasher.compare.mockResolvedValue(true);
      tokenGenerator.generate.mockReturnValue('new-token');

      const result = await service.login('test@example.com', 'password123');

      expect(repository.setAccessToken).toHaveBeenCalledWith(
        user.id,
        'new-token',
        expect.any(Date),
      );
      const [, , expiresAt] = repository.setAccessToken.mock.calls[0];
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(result.accessToken).toBe('new-token');
      expect('password' in result.user).toBe(false);
    });
  });

  describe('validateToken', () => {
    it('rejects an unknown token', async () => {
      repository.findByAccessToken.mockResolvedValue(null);

      await expect(service.validateToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an expired token', async () => {
      const expired = buildUser({
        accessTokenExpiresAt: new Date(Date.now() - 1000),
      });
      repository.findByAccessToken.mockResolvedValue(expired);

      await expect(service.validateToken('old-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns the user for a valid, non-expired token', async () => {
      const user = buildUser({
        accessTokenExpiresAt: new Date(Date.now() + 60_000),
      });
      repository.findByAccessToken.mockResolvedValue(user);

      await expect(service.validateToken('good-token')).resolves.toBe(user);
    });
  });

  describe('logout', () => {
    it('clears the access token for the given user', async () => {
      await service.logout('user-1');

      expect(repository.clearAccessToken).toHaveBeenCalledWith('user-1');
    });
  });
});
