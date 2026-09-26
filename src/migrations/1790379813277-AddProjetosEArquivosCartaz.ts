import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProjetosEArquivosCartaz1790379813277 implements MigrationInterface {
    name = 'AddProjetosEArquivosCartaz1790379813277'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."projetos_cartaz_tipo_enum" AS ENUM('story', 'panfleto', 'planilha')`);
        await queryRunner.query(`CREATE TABLE "projetos_cartaz" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "criado_por_id" uuid, "tipo" "public"."projetos_cartaz_tipo_enum" NOT NULL, "nome" character varying(120) NOT NULL, "estado_editor" jsonb NOT NULL DEFAULT '{}', "criado_em" TIMESTAMP NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3a0dab36d761e6392f301efad44" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_05807c62f6bd522a1128ee6d54" ON "projetos_cartaz" ("organizacao_id") `);
        await queryRunner.query(`CREATE TYPE "public"."arquivos_cartaz_status_enum" AS ENUM('pendente', 'confirmado')`);
        await queryRunner.query(`CREATE TABLE "arquivos_cartaz" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "projeto_id" uuid, "criado_por_id" uuid, "mime_type" character varying(120) NOT NULL, "tamanho_bytes" integer NOT NULL, "status" "public"."arquivos_cartaz_status_enum" NOT NULL DEFAULT 'pendente', "criado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2fadf510c5ddcf784a677a99a63" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f89457c0faee7805255fc9f313" ON "arquivos_cartaz" ("organizacao_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cee1ede8577bc7b599773d6cc3" ON "arquivos_cartaz" ("projeto_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_83a7ff2cbdc399fd8e963e328b" ON "arquivos_cartaz" ("status", "criado_em") `);
        await queryRunner.query(`ALTER TABLE "projetos_cartaz" ADD CONSTRAINT "FK_05807c62f6bd522a1128ee6d543" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "projetos_cartaz" ADD CONSTRAINT "FK_5407f64c3ff0bbeb1f0af748567" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "arquivos_cartaz" ADD CONSTRAINT "FK_f89457c0faee7805255fc9f313f" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "arquivos_cartaz" ADD CONSTRAINT "FK_cee1ede8577bc7b599773d6cc31" FOREIGN KEY ("projeto_id") REFERENCES "projetos_cartaz"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "arquivos_cartaz" DROP CONSTRAINT "FK_cee1ede8577bc7b599773d6cc31"`);
        await queryRunner.query(`ALTER TABLE "arquivos_cartaz" DROP CONSTRAINT "FK_f89457c0faee7805255fc9f313f"`);
        await queryRunner.query(`ALTER TABLE "projetos_cartaz" DROP CONSTRAINT "FK_5407f64c3ff0bbeb1f0af748567"`);
        await queryRunner.query(`ALTER TABLE "projetos_cartaz" DROP CONSTRAINT "FK_05807c62f6bd522a1128ee6d543"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_83a7ff2cbdc399fd8e963e328b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cee1ede8577bc7b599773d6cc3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f89457c0faee7805255fc9f313"`);
        await queryRunner.query(`DROP TABLE "arquivos_cartaz"`);
        await queryRunner.query(`DROP TYPE "public"."arquivos_cartaz_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_05807c62f6bd522a1128ee6d54"`);
        await queryRunner.query(`DROP TABLE "projetos_cartaz"`);
        await queryRunner.query(`DROP TYPE "public"."projetos_cartaz_tipo_enum"`);
    }

}
