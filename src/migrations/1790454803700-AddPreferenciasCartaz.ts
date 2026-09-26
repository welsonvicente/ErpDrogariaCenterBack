import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreferenciasCartaz1790454803700 implements MigrationInterface {
    name = 'AddPreferenciasCartaz1790454803700'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."preferencias_cartaz_chave_enum" AS ENUM('story', 'panfleto', 'planilha', 'logo_story')`);
        await queryRunner.query(`CREATE TABLE "preferencias_cartaz" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "chave" "public"."preferencias_cartaz_chave_enum" NOT NULL, "valor" jsonb NOT NULL DEFAULT '{}', "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_949b59e3917300d698529957011" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_cc8734319a5001d68ea5cf1e4d" ON "preferencias_cartaz" ("organizacao_id", "chave") `);
        await queryRunner.query(`ALTER TABLE "preferencias_cartaz" ADD CONSTRAINT "FK_4f5b0640b0f0b6fc7a277cd2f9f" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "preferencias_cartaz" DROP CONSTRAINT "FK_4f5b0640b0f0b6fc7a277cd2f9f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cc8734319a5001d68ea5cf1e4d"`);
        await queryRunner.query(`DROP TABLE "preferencias_cartaz"`);
        await queryRunner.query(`DROP TYPE "public"."preferencias_cartaz_chave_enum"`);
    }

}
