import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRegistroAuditoria1789271830253 implements MigrationInterface {
    name = 'AddRegistroAuditoria1789271830253'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "registros_auditoria" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "usuario_nome" character varying(120) NOT NULL, "usuario_email" character varying(160), "acao" character varying(60) NOT NULL, "detalhes" character varying(500), "criado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_52a47d9f5f33f509ae83e56a747" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b210f4c7f7d5ce15f63de6de23" ON "registros_auditoria" ("organizacao_id") `);
        await queryRunner.query(`ALTER TABLE "registros_auditoria" ADD CONSTRAINT "FK_b210f4c7f7d5ce15f63de6de231" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "registros_auditoria" DROP CONSTRAINT "FK_b210f4c7f7d5ce15f63de6de231"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b210f4c7f7d5ce15f63de6de23"`);
        await queryRunner.query(`DROP TABLE "registros_auditoria"`);
    }

}
