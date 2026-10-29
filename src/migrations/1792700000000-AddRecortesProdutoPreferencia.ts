import { MigrationInterface, QueryRunner } from "typeorm";

/** Nova chave de preferência: biblioteca de recortes de produto (ver ChavePreferenciaCartaz.RECORTES_PRODUTO). */
export class AddRecortesProdutoPreferencia1792700000000 implements MigrationInterface {
    name = 'AddRecortesProdutoPreferencia1792700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."preferencias_cartaz_chave_enum" ADD VALUE IF NOT EXISTS 'recortes_produto'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // O Postgres não remove valor de ENUM; apaga as linhas que usam o valor, e ele fica sem uso.
        await queryRunner.query(`DELETE FROM "preferencias_cartaz" WHERE "chave" = 'recortes_produto'`);
    }
}
