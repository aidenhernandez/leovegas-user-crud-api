import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../src/config/typeorm.config';
import { User } from '../src/users/entities/user.entity';
import { Role } from '../src/users/entities/role.enum';

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10);

  if (!email || !password) {
    throw new Error(
      'ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set to seed the admin user',
    );
  }

  await AppDataSource.initialize();
  const repository = AppDataSource.getRepository(User);

  const existing = await repository.findOneBy({ email });
  if (existing) {
    console.log(`Admin user ${email} already exists, skipping seed.`);
    await AppDataSource.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(password, saltRounds);
  const admin = repository.create({
    name: 'Admin',
    email,
    password: passwordHash,
    role: Role.ADMIN,
    accessToken: null,
  });
  await repository.save(admin);
  console.log(`Seeded admin user ${email}.`);

  await AppDataSource.destroy();
}

seedAdmin().catch((error: unknown) => {
  console.error('Failed to seed admin user:', error);
  process.exit(1);
});
