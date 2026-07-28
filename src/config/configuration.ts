import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_DATABASE: Joi.string().required(),

  BCRYPT_SALT_ROUNDS: Joi.number().default(10),

  ADMIN_SEED_EMAIL: Joi.string()
    .email({ tlds: { allow: false } })
    .required(),
  ADMIN_SEED_PASSWORD: Joi.string().min(8).required(),
});

export interface AppConfig {
  port: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  bcryptSaltRounds: number;
  adminSeed: {
    email: string;
    password: string;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USERNAME ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? '',
  },
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10),
  adminSeed: {
    email: process.env.ADMIN_SEED_EMAIL ?? '',
    password: process.env.ADMIN_SEED_PASSWORD ?? '',
  },
});
