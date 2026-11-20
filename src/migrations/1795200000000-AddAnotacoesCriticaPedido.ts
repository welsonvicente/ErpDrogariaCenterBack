import { MigrationInterface, QueryRunner } from "typeorm";

/** Motivo/observação por linha da crítica de pedido (ex.: item incluído em urgência). */
export class AddAnotacoesCriticaPedido1795200000000 implements MigrationInterface {
    name = 'AddAnotacoesCriticaPedido1795200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "criticas_pedido" ADD "anotacoes" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "criticas_pedido" DROP COLUMN "anotacoes"`);
    }

}
