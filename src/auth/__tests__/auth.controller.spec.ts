import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { UserSerializer } from '../../users/serializers/user.serializer';
import { LoginDto } from '../dto/login.dto';
import { buildUser } from '../../test/fixtures/user.fixture';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Pick<AuthService, 'login'>>;
  let serializer: jest.Mocked<Pick<UserSerializer, 'serialize'>>;

  beforeEach(() => {
    authService = { login: jest.fn() };
    serializer = { serialize: jest.fn() };

    controller = new AuthController(
      authService as unknown as AuthService,
      serializer as unknown as UserSerializer,
    );
  });

  it('login() serializes the user and attaches the access token as resource meta', async () => {
    const dto: LoginDto = { email: 'a@example.com', password: 'password123' };
    const user = buildUser();
    authService.login.mockResolvedValue({ user, accessToken: 'a-token' });
    serializer.serialize.mockReturnValue({
      type: 'users',
      id: user.id,
      attributes: {
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });

    const result = await controller.login(dto);

    expect(authService.login).toHaveBeenCalledWith(dto.email, dto.password);
    expect(serializer.serialize).toHaveBeenCalledWith(user);
    expect(result).toMatchObject({
      type: 'users',
      id: user.id,
      meta: { accessToken: 'a-token' },
    });
    expect(result).not.toHaveProperty('attributes.password');
    expect(result).not.toHaveProperty('attributes.accessToken');
  });
});
