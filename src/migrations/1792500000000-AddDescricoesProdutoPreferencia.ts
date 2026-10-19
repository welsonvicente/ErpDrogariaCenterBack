import { MigrationInterface, QueryRunner } from "typeorm";

/** Nova chave de preferência: dicionário de descrições de produto editadas (ver ChavePreferenciaCartaz.DESCRICOES_PRODUTO). */
export class AddDescricoesProdutoPreferencia1792500000000 implements MigrationInterface {
    name = 'AddDescricoesProdutoPreferencia1792500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."preferencias_cartaz_chave_enum" ADD VALUE IF NOT EXISTS 'descricoes_produto'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // O Postgres não remove valor de ENUM; apaga as linhas que usam o valor, e ele fica sem uso.
        await queryRunner.query(`DELETE FROM "preferencias_cartaz" WHERE "chave" = 'descricoes_produto'`);
    }
}
