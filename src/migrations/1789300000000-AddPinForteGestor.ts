import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `pin_forte` marca que o funcionario definiu, ele mesmo, um PIN no padrao
 * exigido de quem acessa o Painel do Gestor.
 *
 * Nasce false pra TODO mundo, inclusive pra quem ja tem `pode_acessar_gestor`:
 * o PIN atual dessas contas foi escolhido pro login de balcao (4 digitos) e,
 * em alguns casos, e conhecido pelo gestor que o cadastrou. Como a permissao
 * passa a valer de verdade, essas contas definem um PIN novo no primeiro
 * acesso ao painel (ver PerfilService.definirPinGestor) — nao existe PIN
 * padrao em lugar nenhum, de proposito.
 */
export class AddPinForteGestor1789300000000 implements MigrationInterface {
    name = 'AddPinForteGestor1789300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "pin_forte" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "pin_forte"`);
    }
}
