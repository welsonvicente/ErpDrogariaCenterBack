import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExigeBeneficiarioToCategorias1789271048072 implements MigrationInterface {
    name = 'AddExigeBeneficiarioToCategorias1789271048072'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categorias" ADD "exige_beneficiario" boolean NOT NULL DEFAULT false`);

        // Correcao de dado: essa exigencia antes era decidida comparando o
        // nome da categoria com "Diaria de domingo ou feriado" (ver
        // DespesaService antes desta migracao). Marca a coluna nova em toda
        // organizacao que ja tem essa categoria, pra preservar o
        // comportamento existente.
        await queryRunner.query(`
            UPDATE categorias
            SET exige_beneficiario = true
            WHERE nome = 'Diária de domingo ou feriado'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categorias" DROP COLUMN "exige_beneficiario"`);
    }

}
