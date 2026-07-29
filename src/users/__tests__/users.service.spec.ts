import { UsersService } from '../users.service';
import { IUsersRepository } from '../repositories/users-repository.interface';
import { IUserAccessPolicy } from '../policies/user-access-policy.interface';
import { IPasswordHasher } from '../../auth/hashing/password-hasher.interface';
import { Role } from '../entities/role.enum';
import { ForbiddenActionException } from '../../common/exceptions/forbidden-action.exception';
import { UserNotFoundException } from '../../common/exceptions/user-not-found.exception';
import { DuplicateEmailException } from '../../common/exceptions/duplicate-email.exception';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { buildUser } from '../../test/fixtures/user.fixture';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<IUsersRepository>;
  let accessPolicy: jest.Mocked<IUserAccessPolicy>;
  let passwordHasher: jest.Mocked<IPasswordHasher>;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailWithCredentials: jest.fn(),
      findByAccessToken: jest.fn(),
      findAll: jest.fn(),
      existsByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateAccessToken: jest.fn(),
      delete: jest.fn(),
    };
    accessPolicy = {
      canView: jest.fn(),
      canList: jest.fn(),
      canUpdate: jest.fn(),
      canDelete: jest.fn(),
    };
    passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    };

    service = new UsersService(repository, accessPolicy, passwordHasher);
  });

  describe('create', () => {
    const dto: CreateUserDto = {
      name: 'A',
      email: 'a@example.com',
      password: 'password123',
    };

    it('rejects a duplicate email before hashing anything', async () => {
      repository.existsByEmail.mockResolvedValue(true);

      await expect(service.create(dto)).rejects.toThrow(
        DuplicateEmailException,
      );
      expect(passwordHasher.hash).not.toHaveBeenCalled();
    });

    it('forces role to USER for an anonymous requester, even if ADMIN is requested', async () => {
      repository.existsByEmail.mockResolvedValue(false);
      passwordHasher.hash.mockResolvedValue('hashed');
      repository.create.mockResolvedValue(buildUser());

      await service.create({ ...dto, role: Role.ADMIN });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.USER }),
      );
    });

    it('forces role to USER when the requester is a plain USER, even if ADMIN is requested', async () => {
      repository.existsByEmail.mockResolvedValue(false);
      passwordHasher.hash.mockResolvedValue('hashed');
      repository.create.mockResolvedValue(buildUser());
      const requester = buildUser({ role: Role.USER });

      await service.create({ ...dto, role: Role.ADMIN }, requester);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.USER }),
      );
    });

    it('honors the requested role when the requester is an ADMIN', async () => {
      repository.existsByEmail.mockResolvedValue(false);
      passwordHasher.hash.mockResolvedValue('hashed');
      repository.create.mockResolvedValue(buildUser());
      const requester = buildUser({ role: Role.ADMIN });

      await service.create({ ...dto, role: Role.ADMIN }, requester);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.ADMIN }),
      );
    });
  });

  describe('findAll', () => {
    it('forbids a non-admin from listing', async () => {
      accessPolicy.canList.mockReturnValue(false);

      await expect(service.findAll(buildUser())).rejects.toThrow(
        ForbiddenActionException,
      );
      expect(repository.findAll).not.toHaveBeenCalled();
    });

    it('returns all users for an admin', async () => {
      accessPolicy.canList.mockReturnValue(true);
      const users = [buildUser(), buildUser({ id: 'user-2' })];
      repository.findAll.mockResolvedValue(users);

      await expect(
        service.findAll(buildUser({ role: Role.ADMIN })),
      ).resolves.toBe(users);
    });
  });

  describe('findOne', () => {
    it('forbids access without consulting the repository (no id-existence leak)', async () => {
      accessPolicy.canView.mockReturnValue(false);

      await expect(service.findOne(buildUser(), 'target-id')).rejects.toThrow(
        ForbiddenActionException,
      );
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('throws UserNotFoundException when access is allowed but the id does not exist', async () => {
      accessPolicy.canView.mockReturnValue(true);
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findOne(buildUser({ role: Role.ADMIN }), 'missing-id'),
      ).rejects.toThrow(UserNotFoundException);
    });

    it('returns the user when access is allowed and the id is found', async () => {
      accessPolicy.canView.mockReturnValue(true);
      const target = buildUser({ id: 'target-id' });
      repository.findById.mockResolvedValue(target);

      await expect(service.findOne(buildUser(), 'target-id')).resolves.toBe(
        target,
      );
    });
  });

  describe('update', () => {
    it('flags a role field in the dto as a role change when consulting the policy', async () => {
      accessPolicy.canUpdate.mockReturnValue(false);

      await expect(
        service.update(buildUser(), 'target-id', { role: Role.ADMIN }),
      ).rejects.toThrow(ForbiddenActionException);
      expect(accessPolicy.canUpdate).toHaveBeenCalledWith(
        expect.anything(),
        'target-id',
        true,
      );
    });

    it('does not flag an update without a role field as a role change', async () => {
      accessPolicy.canUpdate.mockReturnValue(true);
      repository.findById.mockResolvedValue(buildUser());
      repository.update.mockResolvedValue(buildUser());

      await service.update(buildUser(), 'target-id', { name: 'New Name' });

      expect(accessPolicy.canUpdate).toHaveBeenCalledWith(
        expect.anything(),
        'target-id',
        false,
      );
    });

    it('throws UserNotFoundException if the target does not exist', async () => {
      accessPolicy.canUpdate.mockReturnValue(true);
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(buildUser({ role: Role.ADMIN }), 'missing-id', {}),
      ).rejects.toThrow(UserNotFoundException);
    });

    it('rejects changing the email to one already in use by someone else', async () => {
      accessPolicy.canUpdate.mockReturnValue(true);
      repository.findById.mockResolvedValue(
        buildUser({ email: 'old@example.com' }),
      );
      repository.existsByEmail.mockResolvedValue(true);

      const dto: UpdateUserDto = { email: 'new@example.com' };
      await expect(
        service.update(buildUser({ role: Role.ADMIN }), 'target-id', dto),
      ).rejects.toThrow(DuplicateEmailException);
    });

    it('allows keeping the same email without checking uniqueness', async () => {
      accessPolicy.canUpdate.mockReturnValue(true);
      repository.findById.mockResolvedValue(
        buildUser({ email: 'same@example.com' }),
      );
      repository.update.mockResolvedValue(buildUser());

      await service.update(buildUser({ role: Role.ADMIN }), 'target-id', {
        email: 'same@example.com',
      });

      expect(repository.existsByEmail).not.toHaveBeenCalled();
    });

    it('hashes a new password when one is provided', async () => {
      accessPolicy.canUpdate.mockReturnValue(true);
      repository.findById.mockResolvedValue(buildUser());
      passwordHasher.hash.mockResolvedValue('new-hash');
      repository.update.mockResolvedValue(buildUser());

      await service.update(buildUser({ role: Role.ADMIN }), 'target-id', {
        password: 'newpassword123',
      });

      expect(passwordHasher.hash).toHaveBeenCalledWith('newpassword123');
      expect(repository.update).toHaveBeenCalledWith(
        'target-id',
        expect.objectContaining({ passwordHash: 'new-hash' }),
      );
    });
  });

  describe('remove', () => {
    it('forbids deletion without consulting the repository', async () => {
      accessPolicy.canDelete.mockReturnValue(false);

      await expect(service.remove(buildUser(), 'target-id')).rejects.toThrow(
        ForbiddenActionException,
      );
      expect(repository.findById).not.toHaveBeenCalled();
    });

    it('throws UserNotFoundException for a non-existent target', async () => {
      accessPolicy.canDelete.mockReturnValue(true);
      repository.findById.mockResolvedValue(null);

      await expect(
        service.remove(buildUser({ role: Role.ADMIN }), 'missing-id'),
      ).rejects.toThrow(UserNotFoundException);
    });

    it('deletes an existing, permitted target', async () => {
      accessPolicy.canDelete.mockReturnValue(true);
      repository.findById.mockResolvedValue(buildUser({ id: 'target-id' }));

      await service.remove(buildUser({ role: Role.ADMIN }), 'target-id');

      expect(repository.delete).toHaveBeenCalledWith('target-id');
    });
  });
});
