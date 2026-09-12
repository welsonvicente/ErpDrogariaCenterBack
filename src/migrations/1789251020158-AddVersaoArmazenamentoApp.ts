import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVersaoArmazenamentoApp1789251020158 implements MigrationInterface {
    name = 'AddVersaoArmazenamentoApp1789251020158'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "armazenamento_app" ADD "versao" integer NOT NULL DEFAULT '1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "armazenamento_app" DROP COLUMN "versao"`);
    }

}
