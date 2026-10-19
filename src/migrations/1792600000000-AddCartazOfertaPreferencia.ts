import { MigrationInterface, QueryRunner } from "typeorm";

/** Nova chave de preferência: folha A4 do Cartaz de oferta salva no servidor (ver ChavePreferenciaCartaz.CARTAZ_OFERTA). */
export class AddCartazOfertaPreferencia1792600000000 implements MigrationInterface {
    name = 'AddCartazOfertaPreferencia1792600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."preferencias_cartaz_chave_enum" ADD VALUE IF NOT EXISTS 'cartaz_oferta'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // O Postgres não remove valor de ENUM; apaga as linhas que usam o valor, e ele fica sem uso.
        await queryRunner.query(`DELETE FROM "preferencias_cartaz" WHERE "chave" = 'cartaz_oferta'`);
    }
}
