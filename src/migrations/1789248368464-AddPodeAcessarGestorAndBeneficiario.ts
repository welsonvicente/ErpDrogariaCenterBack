import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPodeAcessarGestorAndBeneficiario1789248368464 implements MigrationInterface {
    name = 'AddPodeAcessarGestorAndBeneficiario1789248368464'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "pode_acessar_gestor" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "despesas" ADD "beneficiario_id" uuid`);
        await queryRunner.query(`ALTER TABLE "despesas" ADD CONSTRAINT "FK_54e6880c090226a11a0006ca852" FOREIGN KEY ("beneficiario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        // Correcao de dado: concede o atalho pro painel do gestor ao funcionario
        // codigo "1" da organizacao "drogariacenter" (Welson) — mesmo criterio
        // usado em FixDespesasLancadasComoAdmin pra identificar essa conta.
        await queryRunner.query(`
            UPDATE usuarios u
            SET pode_acessar_gestor = true
            FROM organizacoes o
            WHERE u.organizacao_id = o.id
              AND o.slug = 'drogariacenter'
              AND u.codigo = '1'
              AND u.perfil = 'FUNCIONARIO'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "despesas" DROP CONSTRAINT "FK_54e6880c090226a11a0006ca852"`);
        await queryRunner.query(`ALTER TABLE "despesas" DROP COLUMN "beneficiario_id"`);
        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "pode_acessar_gestor"`);
    }

}
