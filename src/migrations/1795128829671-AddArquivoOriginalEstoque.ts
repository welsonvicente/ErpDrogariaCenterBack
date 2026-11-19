import { MigrationInterface, QueryRunner } from "typeorm";

/** Guarda o .xlsx original de cada importação de estoque (bytea), pra baixar de novo de qualquer aparelho. */
export class AddArquivoOriginalEstoque1795128829671 implements MigrationInterface {
    name = 'AddArquivoOriginalEstoque1795128829671'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "estoque_importacoes" ADD "arquivo_original" bytea`);
        await queryRunner.query(`ALTER TABLE "estoque_importacoes" ADD "arquivo_mime" character varying(120)`);
        await queryRunner.query(`ALTER TABLE "estoque_importacoes" ADD "arquivo_tamanho" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "estoque_importacoes" DROP COLUMN "arquivo_tamanho"`);
        await queryRunner.query(`ALTER TABLE "estoque_importacoes" DROP COLUMN "arquivo_mime"`);
        await queryRunner.query(`ALTER TABLE "estoque_importacoes" DROP COLUMN "arquivo_original"`);
    }

}
