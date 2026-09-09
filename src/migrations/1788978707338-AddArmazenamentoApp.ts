import { MigrationInterface, QueryRunner } from "typeorm";

export class AddArmazenamentoApp1788978707338 implements MigrationInterface {
    name = 'AddArmazenamentoApp1788978707338'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "armazenamento_app" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "chave" character varying(120) NOT NULL, "valor" text NOT NULL, "criado_em" TIMESTAMP NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uk_armazenamento_app_organizacao_chave" UNIQUE ("organizacao_id", "chave"), CONSTRAINT "PK_48dfdb1c946e0b6433514f02723" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "armazenamento_app" ADD CONSTRAINT "FK_acee087f869288b16cb0ce90b4d" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "armazenamento_app" DROP CONSTRAINT "FK_acee087f869288b16cb0ce90b4d"`);
        await queryRunner.query(`DROP TABLE "armazenamento_app"`);
    }

}
