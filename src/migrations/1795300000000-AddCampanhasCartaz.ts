import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Campanhas de Cartazes: agrupam os projetos (Story/Panfleto/Importar) e guardam a folha do
 * Cartaz de oferta. Quem já usava Cartazes ganha uma campanha "Campanha atual" com tudo o que
 * existia (projetos e a folha A4 que estava na preferência) — nada se perde.
 */
export class AddCampanhasCartaz1795300000000 implements MigrationInterface {
    name = 'AddCampanhasCartaz1795300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "campanhas_cartaz" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "criado_por_id" uuid, "nome" character varying(120) NOT NULL, "folha_oferta" jsonb NOT NULL DEFAULT '{}', "criado_em" TIMESTAMP NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_campanhas_cartaz" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_campanhas_cartaz_organizacao" ON "campanhas_cartaz" ("organizacao_id") `);
        await queryRunner.query(`ALTER TABLE "campanhas_cartaz" ADD CONSTRAINT "FK_campanhas_cartaz_organizacao" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "campanhas_cartaz" ADD CONSTRAINT "FK_campanhas_cartaz_criado_por" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "projetos_cartaz" ADD "campanha_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_projetos_cartaz_campanha" ON "projetos_cartaz" ("campanha_id") `);
        await queryRunner.query(`ALTER TABLE "projetos_cartaz" ADD CONSTRAINT "FK_projetos_cartaz_campanha" FOREIGN KEY ("campanha_id") REFERENCES "campanhas_cartaz"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        // Dados que já existiam viram a "Campanha atual" de cada organização.
        await queryRunner.query(`
            INSERT INTO "campanhas_cartaz" ("organizacao_id", "nome", "folha_oferta")
            SELECT o."id", 'Campanha atual',
                   COALESCE((SELECT p."valor" FROM "preferencias_cartaz" p WHERE p."organizacao_id" = o."id" AND p."chave"::text = 'cartaz_oferta'), '{}'::jsonb)
            FROM "organizacoes" o
            WHERE EXISTS (SELECT 1 FROM "projetos_cartaz" pc WHERE pc."organizacao_id" = o."id")
               OR EXISTS (SELECT 1 FROM "preferencias_cartaz" p WHERE p."organizacao_id" = o."id" AND p."chave"::text = 'cartaz_oferta')`);
        await queryRunner.query(`
            UPDATE "projetos_cartaz" pc SET "campanha_id" = c."id"
            FROM "campanhas_cartaz" c
            WHERE c."organizacao_id" = pc."organizacao_id" AND pc."campanha_id" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projetos_cartaz" DROP CONSTRAINT "FK_projetos_cartaz_campanha"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_projetos_cartaz_campanha"`);
        await queryRunner.query(`ALTER TABLE "projetos_cartaz" DROP COLUMN "campanha_id"`);
        await queryRunner.query(`ALTER TABLE "campanhas_cartaz" DROP CONSTRAINT "FK_campanhas_cartaz_criado_por"`);
        await queryRunner.query(`ALTER TABLE "campanhas_cartaz" DROP CONSTRAINT "FK_campanhas_cartaz_organizacao"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_campanhas_cartaz_organizacao"`);
        await queryRunner.query(`DROP TABLE "campanhas_cartaz"`);
    }
}
