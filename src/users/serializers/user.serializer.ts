import { Injectable } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { IResourceSerializer } from '../../common/jsonapi/serializers/serializer.interface';
import { JsonApiResourceObject } from '../../common/jsonapi/jsonapi.types';

export interface UserAttributes {
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Explicit output whitelist for the User resource. `password`/`accessToken`
 * are never read here, even though the entity type technically has them -
 * this is the second, independent line of defense against leaking secrets,
 * on top of the `{ select: false }` columns on the entity itself.
 */
@Injectable()
export class UserSerializer implements IResourceSerializer<
  User,
  UserAttributes
> {
  readonly type = 'users';

  serialize(user: User): JsonApiResourceObject<UserAttributes> {
    return {
      type: this.type,
      id: user.id,
      attributes: {
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }
}
