import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Correcao de dado: algumas despesas da organizacao "drogariacenter" foram
 * lancadas via chamada direta a API (fora da tela de funcionario) usando o
 * token do usuario ADMIN, entao ficaram com usuario_id apontando pro admin
 * em vez do funcionario que realmente lancou o gasto no balcao (codigo "1").
 * Como a tela de lancamento so existe para FUNCIONARIO, qualquer despesa
 * anexada a um ADMIN nessa organizacao e sempre esse caso.
 */
export class FixDespesasLancadasComoAdmin1788560108771 implements MigrationInterface {
    name = 'FixDespesasLancadasComoAdmin1788560108771'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE despesas d
            SET usuario_id = (
                SELECT u2.id FROM usuarios u2
                JOIN organizacoes o2 ON o2.id = u2.organizacao_id
                WHERE o2.slug = 'drogariacenter' AND u2.codigo = '1' AND u2.perfil = 'FUNCIONARIO'
            )
            FROM usuarios ua
            JOIN organizacoes o ON o.id = ua.organizacao_id
            WHERE d.usuario_id = ua.id
              AND o.slug = 'drogariacenter'
              AND ua.perfil = 'ADMIN'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Correcao de dado, nao ha como recuperar o usuario_id original.
    }

}
