export const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';

export interface JsonApiResourceObject<TAttributes> {
  type: string;
  id: string;
  attributes: TAttributes;
  meta?: Record<string, unknown>;
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
