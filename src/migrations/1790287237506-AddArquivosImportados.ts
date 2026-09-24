import { MigrationInterface, QueryRunner } from "typeorm";

export class AddArquivosImportados1790287237506 implements MigrationInterface {
    name = 'AddArquivosImportados1790287237506'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "arquivos_importados" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "nome_original" character varying(255) NOT NULL, "mime_type" character varying(120) NOT NULL, "tamanho_bytes" integer NOT NULL, "conteudo" bytea NOT NULL, "criado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a2e63aea29070bb1dd4209de1de" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dd1d6bed363a8b25f706a57aee" ON "arquivos_importados" ("organizacao_id") `);
        await queryRunner.query(`ALTER TABLE "arquivos_importados" ADD CONSTRAINT "FK_dd1d6bed363a8b25f706a57aeeb" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivos_importados" DROP CONSTRAINT "FK_dd1d6bed363a8b25f706a57aeeb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dd1d6bed363a8b25f706a57aee"`);
        await queryRunner.query(`DROP TABLE "arquivos_importados"`);
    }

}
