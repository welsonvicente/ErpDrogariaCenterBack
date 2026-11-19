import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEstoqueInteligencia1795102192598 implements MigrationInterface {
    name = 'AddEstoqueInteligencia1795102192598'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "estoque_config" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "config" jsonb NOT NULL, "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9f9e56ca509dcdb73645bcc3886" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dbfa5a4f8facdea2e97d99c6fa" ON "estoque_config" ("organizacao_id") `);
        await queryRunner.query(`CREATE TYPE "public"."estoque_historico_tipo_enum" AS ENUM('IMPORTACAO', 'RESTAURACAO', 'EDICAO', 'ACAO', 'CONFIG')`);
        await queryRunner.query(`CREATE TABLE "estoque_historico" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "tipo" "public"."estoque_historico_tipo_enum" NOT NULL, "codigo_trier" character varying(40), "produto_nome" character varying(255), "campo" character varying(60), "valor_anterior" text, "valor_novo" text, "descricao" text, "usuario_nome" character varying(160), "criado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_22e0ae82bb294ba758dcc109fd6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_acb8aa811077e2bcbc186cd87c" ON "estoque_historico" ("organizacao_id", "criado_em") `);
        await queryRunner.query(`CREATE TYPE "public"."estoque_importacoes_modo_enum" AS ENUM('ATUALIZAR', 'SUBSTITUIR', 'RESTAURACAO')`);
        await queryRunner.query(`CREATE TABLE "estoque_importacoes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "nome_arquivo" character varying(255) NOT NULL, "modo" "public"."estoque_importacoes_modo_enum" NOT NULL, "total_linhas" integer NOT NULL DEFAULT '0', "total_produtos" integer NOT NULL DEFAULT '0', "resumo" jsonb NOT NULL, "linhas" jsonb NOT NULL, "restaurada_de_id" uuid, "usuario_nome" character varying(160), "criado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_836a17078da1b1a559c39a8757e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0e9becadfcc23d184e1e193d1a" ON "estoque_importacoes" ("organizacao_id", "criado_em") `);
        await queryRunner.query(`CREATE TYPE "public"."estoque_produtos_status_acao_enum" AS ENUM('NAO_INICIADO', 'PLANEJADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'NAO_APLICAVEL')`);
        await queryRunner.query(`CREATE TABLE "estoque_produtos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "codigo_trier" character varying(40) NOT NULL, "codigo_barras" character varying(40), "produto" character varying(255) NOT NULL, "laboratorio" character varying(200), "grupo" character varying(200), "fornecedor" character varying(200), "estoque_minimo" numeric(14,3), "demanda" numeric(14,3), "saldo" numeric(14,3), "custo_unitario" numeric(14,4), "valor_total" numeric(16,2), "data_ultima_entrada" date, "qtd_ultima_compra" numeric(14,3), "preco_ultima_compra" numeric(14,4), "ativo" boolean NOT NULL DEFAULT true, "importacao_id" uuid, "preco_venda" numeric(14,2), "acao_recomendada" text, "objetivo" text, "como_executar" text, "status_acao" "public"."estoque_produtos_status_acao_enum" NOT NULL DEFAULT 'NAO_INICIADO', "responsavel" character varying(120), "data_inicio" date, "prazo" date, "observacoes" text, "resultado" text, "quantidade_atualizada" numeric(14,3), "negociar_fornecedor" boolean NOT NULL DEFAULT false, "acao_atualizada_em" TIMESTAMP, "criado_em" TIMESTAMP NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5329cbdb8e494e62803ce2f4c67" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_62f92efc4318283b373da432e3" ON "estoque_produtos" ("organizacao_id", "ativo") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dae85d93b850e8e0d32d4515f5" ON "estoque_produtos" ("organizacao_id", "codigo_trier") `);
        await queryRunner.query(`ALTER TABLE "estoque_config" ADD CONSTRAINT "FK_dbfa5a4f8facdea2e97d99c6fa2" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "estoque_historico" ADD CONSTRAINT "FK_d4e19afbcf81853f7b5178f8c9b" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "estoque_importacoes" ADD CONSTRAINT "FK_7eedd2600125e6f8c5243590e58" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "estoque_produtos" ADD CONSTRAINT "FK_5fbf598ee676eeaaad7cf1f9986" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "estoque_produtos" DROP CONSTRAINT "FK_5fbf598ee676eeaaad7cf1f9986"`);
        await queryRunner.query(`ALTER TABLE "estoque_importacoes" DROP CONSTRAINT "FK_7eedd2600125e6f8c5243590e58"`);
        await queryRunner.query(`ALTER TABLE "estoque_historico" DROP CONSTRAINT "FK_d4e19afbcf81853f7b5178f8c9b"`);
        await queryRunner.query(`ALTER TABLE "estoque_config" DROP CONSTRAINT "FK_dbfa5a4f8facdea2e97d99c6fa2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dae85d93b850e8e0d32d4515f5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_62f92efc4318283b373da432e3"`);
        await queryRunner.query(`DROP TABLE "estoque_produtos"`);
        await queryRunner.query(`DROP TYPE "public"."estoque_produtos_status_acao_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e9becadfcc23d184e1e193d1a"`);
        await queryRunner.query(`DROP TABLE "estoque_importacoes"`);
        await queryRunner.query(`DROP TYPE "public"."estoque_importacoes_modo_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_acb8aa811077e2bcbc186cd87c"`);
        await queryRunner.query(`DROP TABLE "estoque_historico"`);
        await queryRunner.query(`DROP TYPE "public"."estoque_historico_tipo_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dbfa5a4f8facdea2e97d99c6fa"`);
        await queryRunner.query(`DROP TABLE "estoque_config"`);
    }

}
