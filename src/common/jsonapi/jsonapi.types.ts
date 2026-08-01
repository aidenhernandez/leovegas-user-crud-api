export const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';

export interface JsonApiResourceObject<TAttributes> {
  type: string;
  id: string;
  attributes: TAttributes;
  meta?: Record<string, unknown>;
}

export interface JsonApiPaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface JsonApiCollectionDocument<TAttributes> {
  data: JsonApiResourceObject<TAttributes>[];
  meta: JsonApiPaginationMeta;
}

export interface JsonApiErrorSource {
  pointer?: string;
}

export interface JsonApiErrorObject {
  status: string;
  title: string;
  detail?: string;
  source?: JsonApiErrorSource;
}

export interface JsonApiErrorResponse {
  errors: JsonApiErrorObject[];
}
