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
      countByRole: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      setAccessToken: jest.fn(),
      clearAccessToken: jest.fn(),
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

      await expect(
        service.findAll(buildUser(), { page: 1, limit: 20 }),
      ).rejects.toThrow(ForbiddenActionException);
      expect(repository.findAll).not.toHaveBeenCalled();
    });

    it('returns a page of users for an admin', async () => {
      accessPolicy.canList.mockReturnValue(true);
      const paginated = {
        items: [buildUser(), buildUser({ id: 'user-2' })],
        totalCount: 2,
      };
      repository.findAll.mockResolvedValue(paginated);

      await expect(
        service.findAll(buildUser({ role: Role.ADMIN }), {
          page: 1,
          limit: 20,
        }),
      ).resolves.toBe(paginated);
    });

    it('converts page/limit into skip/take for the repository', async () => {
      accessPolicy.canList.mockReturnValue(true);
      repository.findAll.mockResolvedValue({ items: [], totalCount: 0 });

      await service.findAll(buildUser({ role: Role.ADMIN }), {
        page: 3,
        limit: 10,
      });

      expect(repository.findAll).toHaveBeenCalledWith({ skip: 20, take: 10 });
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
    it('forbids a non-owner, non-admin without consulting the repository (no id-existence leak)', async () => {
      accessPolicy.canUpdate.mockReturnValue(false);

      await expect(
        service.update(buildUser(), 'target-id', { role: Role.ADMIN }),
      ).rejects.toThrow(ForbiddenActionException);
      expect(accessPolicy.canUpdate).toHaveBeenCalledWith(
        expect.anything(),
        'target-id',
        false,
        false,
      );
      expect(repository.findById).not.toHaveBeenCalled();
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
        false,
      );
      expect(accessPolicy.canUpdate).toHaveBeenCalledTimes(1);
      expect(repository.countByRole).not.toHaveBeenCalled();
    });

    it('does not treat resubmitting the current role as a role change (e.g. a full-representation PUT)', async () => {
      accessPolicy.canUpdate.mockReturnValue(true);
      repository.findById.mockResolvedValue(buildUser({ role: Role.USER }));
      repository.update.mockResolvedValue(buildUser());

      await service.update(
        buildUser({ id: 'target-id', role: Role.USER }),
        'target-id',
        {
          name: 'New Name',
          role: Role.USER,
        },
      );

      expect(accessPolicy.canUpdate).toHaveBeenCalledTimes(1);
      expect(accessPolicy.canUpdate).not.toHaveBeenCalledWith(
        expect.anything(),
        'target-id',
        true,
        expect.anything(),
      );
      expect(repository.countByRole).not.toHaveBeenCalled();
    });

    it('blocks a non-admin from changing their own role to a different value', async () => {
      accessPolicy.canUpdate.mockImplementation(
        (_requester, _targetId, isRoleChange: boolean) => !isRoleChange,
      );
      repository.findById.mockResolvedValue(buildUser({ role: Role.USER }));

      await expect(
        service.update(
          buildUser({ id: 'target-id', role: Role.USER }),
          'target-id',
          { role: Role.ADMIN },
        ),
      ).rejects.toThrow(ForbiddenActionException);
    });

    it('allows an admin to change another user role to a different value', async () => {
      accessPolicy.canUpdate.mockReturnValue(true);
      repository.findById.mockResolvedValue(buildUser({ role: Role.USER }));
      repository.update.mockResolvedValue(buildUser());

      await service.update(buildUser({ role: Role.ADMIN }), 'target-id', {
        role: Role.ADMIN,
      });

      expect(accessPolicy.canUpdate).toHaveBeenCalledWith(
        expect.anything(),
        'target-id',
        true,
        false,
      );
      expect(repository.countByRole).not.toHaveBeenCalled();
    });

    it('does not query the admin count for a promotion (USER -> ADMIN)', async () => {
      accessPolicy.canUpdate.mockReturnValue(true);
      repository.findById.mockResolvedValue(buildUser({ role: Role.USER }));
      repository.update.mockResolvedValue(buildUser());

      await service.update(buildUser({ role: Role.ADMIN }), 'target-id', {
        role: Role.ADMIN,
      });

      expect(repository.countByRole).not.toHaveBeenCalled();
    });

    it('blocks demoting the sole remaining admin, with a specific error message', async () => {
      accessPolicy.canUpdate.mockImplementation(
        (_requester, _targetId, isRoleChange: boolean) => !isRoleChange,
      );
      repository.findById.mockResolvedValue(buildUser({ role: Role.ADMIN }));
      repository.countByRole.mockResolvedValue(1);

      await expect(
        service.update(buildUser({ role: Role.ADMIN }), 'target-id', {
          role: Role.USER,
        }),
      ).rejects.toThrow(
        'Cannot change the role of the last remaining administrator',
      );
      expect(repository.countByRole).toHaveBeenCalledWith(Role.ADMIN);
      expect(accessPolicy.canUpdate).toHaveBeenCalledWith(
        expect.anything(),
        'target-id',
        true,
        true,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('allows demoting an admin when other admins still exist', async () => {
      accessPolicy.canUpdate.mockReturnValue(true);
      repository.findById.mockResolvedValue(buildUser({ role: Role.ADMIN }));
      repository.countByRole.mockResolvedValue(2);
      repository.update.mockResolvedValue(buildUser());

      await service.update(buildUser({ role: Role.ADMIN }), 'target-id', {
        role: Role.USER,
      });

      expect(accessPolicy.canUpdate).toHaveBeenCalledWith(
        expect.anything(),
        'target-id',
        true,
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
