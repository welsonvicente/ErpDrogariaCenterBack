import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Quantidade de unidades retiradas num lancamento.
 *
 * Nasce pra "Retirada de vitaminas ou produtos de campanha", onde o gasto e
 * sempre N unidades entregues a alguem — sem o numero de unidades, o valor
 * total nao diz se foram duas caixas ou vinte. Fica generico (uma flag na
 * categoria, como `exige_beneficiario`) porque a proxima categoria desse tipo
 * nao deve precisar de coluna nova.
 *
 * `quantidade` e anulavel: as despesas ja lancadas nao tem esse dado, e as
 * categorias que nao pedem unidades seguem sem ele.
 *
 * A mesma categoria passa a exigir tambem o beneficiario — a pergunta
 * "colaborador que ira receber" ja existia no sistema (`exige_beneficiario`),
 * so nao estava ligada aqui.
 */
export class AddQuantidadeDespesa1789400000000 implements MigrationInterface {
    name = 'AddQuantidadeDespesa1789400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categorias" ADD "exige_quantidade" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "despesas" ADD "quantidade" integer`);

        // Liga as duas perguntas na categoria de vitaminas de TODAS as
        // organizacoes que ja a tenham (ela vem das categorias padrao, entao
        // existe em toda organizacao criada pelo cadastro ou pelo seed).
        await queryRunner.query(`
            UPDATE categorias
            SET exige_quantidade = true, exige_beneficiario = true
            WHERE nome = 'Retirada de vitaminas ou produtos de campanha'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE categorias
            SET exige_beneficiario = false
            WHERE nome = 'Retirada de vitaminas ou produtos de campanha'
        `);
        await queryRunner.query(`ALTER TABLE "despesas" DROP COLUMN "quantidade"`);
        await queryRunner.query(`ALTER TABLE "categorias" DROP COLUMN "exige_quantidade"`);
    }
}
