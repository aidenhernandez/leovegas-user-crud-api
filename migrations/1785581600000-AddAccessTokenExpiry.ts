import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccessTokenExpiry1785581600000 implements MigrationInterface {
  name = 'AddAccessTokenExpiry1785581600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`access_token_expires_at\` datetime(6) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`access_token_expires_at\``,
    );
  }
}
