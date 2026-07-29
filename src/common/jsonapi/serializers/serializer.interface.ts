import { JsonApiResourceObject } from '../jsonapi.types';

/**
 * Shapes a domain entity into a JSON:API resource object. One implementation
 * per resource type; adding a new resource never requires touching the
 * envelope interceptor or exception filter (OCP).
 */
export interface IResourceSerializer<TEntity, TAttributes> {
  readonly type: string;
  serialize(entity: TEntity): JsonApiResourceObject<TAttributes>;
}
