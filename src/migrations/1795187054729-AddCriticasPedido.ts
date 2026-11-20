import { MigrationInterface, QueryRunner } from "typeorm";

/** Críticas de pedido salvas (CotaPreço × Trier): dados lidos, decisões e os PDFs originais. */
export class AddCriticasPedido1795187054729 implements MigrationInterface {
    name = 'AddCriticasPedido1795187054729'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."criticas_pedido_veredito_enum" AS ENUM('APROVADO', 'APROVADO_COM_RESSALVAS', 'REPROVADO')`);
        await queryRunner.query(`CREATE TABLE "criticas_pedido" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "titulo" character varying(200) NOT NULL, "distribuidora" character varying(200), "numero_pedido" character varying(80), "periodo_trier" character varying(80), "veredito" "public"."criticas_pedido_veredito_enum" NOT NULL, "total_pedido" numeric(14,2), "total_trier" numeric(14,2), "diferenca" numeric(14,2), "contagens" jsonb NOT NULL, "pedido" jsonb NOT NULL, "relatorio" jsonb NOT NULL, "decisoes" jsonb NOT NULL DEFAULT '{}', "tolerancias" jsonb NOT NULL, "pdf_cota_nome" character varying(255), "pdf_cota" bytea, "pdf_trier_nome" character varying(255), "pdf_trier" bytea, "usuario_nome" character varying(160), "criado_em" TIMESTAMP NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e3dbe48a6f913ac03b85f0778e5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_afca16ed0249f7565101662bfc" ON "criticas_pedido" ("organizacao_id", "criado_em") `);
        await queryRunner.query(`ALTER TABLE "criticas_pedido" ADD CONSTRAINT "FK_f2fc12c8c97391d7e53cf66a906" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "criticas_pedido" DROP CONSTRAINT "FK_f2fc12c8c97391d7e53cf66a906"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_afca16ed0249f7565101662bfc"`);
        await queryRunner.query(`DROP TABLE "criticas_pedido"`);
        await queryRunner.query(`DROP TYPE "public"."criticas_pedido_veredito_enum"`);
    }

}
