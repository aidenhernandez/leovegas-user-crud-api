import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { UserSerializer } from '../serializers/user.serializer';
import { Role } from '../entities/role.enum';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { buildUser } from '../../test/fixtures/user.fixture';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<
    Pick<UsersService, 'create' | 'findAll' | 'findOne' | 'update' | 'remove'>
  >;
  let serializer: jest.Mocked<Pick<UserSerializer, 'serialize'>>;

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    serializer = { serialize: jest.fn() };

    controller = new UsersController(
      usersService as unknown as UsersService,
      serializer as unknown as UserSerializer,
    );
  });

  it('create() delegates to the service and serializes the result', async () => {
    const requester = buildUser({ role: Role.ADMIN });
    const created = buildUser();
    const dto: CreateUserDto = {
      name: 'A',
      email: 'a@example.com',
      password: 'password123',
    };
    usersService.create.mockResolvedValue(created);
    serializer.serialize.mockReturnValue({
      type: 'users',
      id: created.id,
      attributes: {} as never,
    });

    await controller.create(dto, requester);

    expect(usersService.create).toHaveBeenCalledWith(dto, requester);
    expect(serializer.serialize).toHaveBeenCalledWith(created);
  });

  it('findAll() delegates to the service and serializes every result', async () => {
    const requester = buildUser({ role: Role.ADMIN });
    const users = [buildUser(), buildUser({ id: 'user-2' })];
    usersService.findAll.mockResolvedValue(users);
    serializer.serialize.mockImplementation((user) => ({
      type: 'users',
      id: user.id,
      attributes: {} as never,
    }));

    const result = await controller.findAll(requester);

    expect(usersService.findAll).toHaveBeenCalledWith(requester);
    expect(result).toHaveLength(2);
  });

  it('findOne() delegates to the service with the requester and target id', async () => {
    const requester = buildUser();
    const target = buildUser({ id: 'target-id' });
    usersService.findOne.mockResolvedValue(target);
    serializer.serialize.mockReturnValue({
      type: 'users',
      id: target.id,
      attributes: {} as never,
    });

    await controller.findOne(requester, 'target-id');

    expect(usersService.findOne).toHaveBeenCalledWith(requester, 'target-id');
  });

  it('update() and replace() both delegate to the same service method', async () => {
    const requester = buildUser();
    const updated = buildUser();
    const dto: UpdateUserDto = { name: 'New name' };
    usersService.update.mockResolvedValue(updated);
    serializer.serialize.mockReturnValue({
      type: 'users',
      id: updated.id,
      attributes: {} as never,
    });

    await controller.update(requester, 'target-id', dto);
    await controller.replace(requester, 'target-id', dto);

    expect(usersService.update).toHaveBeenCalledTimes(2);
    expect(usersService.update).toHaveBeenNthCalledWith(
      1,
      requester,
      'target-id',
      dto,
    );
    expect(usersService.update).toHaveBeenNthCalledWith(
      2,
      requester,
      'target-id',
      dto,
    );
  });

  it('remove() delegates to the service and returns nothing', async () => {
    const requester = buildUser({ role: Role.ADMIN });
    usersService.remove.mockResolvedValue(undefined);

    const result = await controller.remove(requester, 'target-id');

    expect(usersService.remove).toHaveBeenCalledWith(requester, 'target-id');
    expect(result).toBeUndefined();
  });
});
