import { QueryFailedError, Repository } from 'typeorm';
import { TypeOrmUsersRepository } from '../typeorm-users.repository';
import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.enum';
import { DuplicateEmailException } from '../../../common/exceptions/duplicate-email.exception';

function buildDuplicateEntryError(): QueryFailedError {
  return new QueryFailedError('INSERT INTO users ...', [], {
    code: 'ER_DUP_ENTRY',
    message: "Duplicate entry 'a@example.com' for key 'IDX_email'",
  });
}

describe('TypeOrmUsersRepository', () => {
  let repo: jest.Mocked<
    Pick<Repository<User>, 'create' | 'save' | 'update' | 'findOneBy'>
  >;
  let usersRepository: TypeOrmUsersRepository;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOneBy: jest.fn(),
    };
    usersRepository = new TypeOrmUsersRepository(
      repo as unknown as Repository<User>,
    );
  });

  describe('create', () => {
    it('rethrows DuplicateEmailException when the insert collides on the email unique index', async () => {
      repo.create.mockReturnValue({
        id: 'new-id',
        email: 'a@example.com',
      } as User);
      repo.save.mockRejectedValue(buildDuplicateEntryError());

      await expect(
        usersRepository.create({
          name: 'A',
          email: 'a@example.com',
          passwordHash: 'hash',
          role: Role.USER,
        }),
      ).rejects.toThrow(DuplicateEmailException);
    });

    it('rethrows the original error for a non-duplicate-key failure', async () => {
      repo.create.mockReturnValue({ id: 'new-id' } as User);
      const dbError = new Error('connection lost');
      repo.save.mockRejectedValue(dbError);

      await expect(
        usersRepository.create({
          name: 'A',
          email: 'a@example.com',
          passwordHash: 'hash',
          role: Role.USER,
        }),
      ).rejects.toBe(dbError);
    });
  });

  describe('update', () => {
    it('rethrows DuplicateEmailException when the update collides on the email unique index', async () => {
      repo.update.mockRejectedValue(buildDuplicateEntryError());

      await expect(
        usersRepository.update('target-id', { email: 'a@example.com' }),
      ).rejects.toThrow(DuplicateEmailException);
    });

    it('rethrows the original error for a non-duplicate-key failure', async () => {
      const dbError = new Error('connection lost');
      repo.update.mockRejectedValue(dbError);

      await expect(
        usersRepository.update('target-id', { email: 'a@example.com' }),
      ).rejects.toBe(dbError);
    });
  });
});
