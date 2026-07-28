export const TOKEN_GENERATOR = Symbol('TOKEN_GENERATOR');

export interface ITokenGenerator {
  generate(): string;
}
