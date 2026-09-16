import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Duas mudancas do mesmo assunto, que precisam acontecer juntas:
 *
 * 1. GESTOR passa a se chamar GERENTE — nome que a empresa usa de verdade.
 *
 * 2. `pode_acessar_gestor` e aposentada. A flag existia porque `perfil`
 *    misturava DUAS coisas: como a pessoa entra (e-mail+senha vs codigo+PIN) e
 *    o que ela pode fazer. Quem precisava gerenciar mas entrava por PIN nao
 *    cabia em nenhum perfil, entao ganhou uma flag por fora. Agora o papel diz
 *    so o que a pessoa pode fazer, e a credencial e independente dele — entao
 *    "pode acessar o painel" e simplesmente `perfil = 'GERENTE'`, sem excecao.
 *
 * Quem tinha a flag vira GERENTE mantendo codigo+PIN. `pin_forte` continua
 * valendo: se a pessoa ja definiu o PIN dela, segue valendo; se nao, o painel
 * pede na proxima vez — a regra agora e por papel + credencial (ver
 * middlewares/authMiddleware.requireGerente), entao vale pra qualquer gerente
 * ou admin que entre por PIN, inclusive alguem promovido amanha.
 *
 * `ALTER TYPE ... RENAME VALUE` (Postgres 10+) renomeia o valor do enum sem
 * recriar o tipo nem tocar nas linhas — bem mais seguro que dropar e recriar a
 * coluna, que exigiria converter tudo pra texto e de volta.
 */
export class AposentarPodeAcessarGestor1789310000000 implements MigrationInterface {
    name = 'AposentarPodeAcessarGestor1789310000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."usuarios_perfil_enum" RENAME VALUE 'GESTOR' TO 'GERENTE'`);

        await queryRunner.query(`
            UPDATE usuarios
            SET perfil = 'GERENTE'
            WHERE pode_acessar_gestor = true
              AND perfil = 'FUNCIONARIO'
        `);

        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "pode_acessar_gestor"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "pode_acessar_gestor" boolean NOT NULL DEFAULT false`);

        // Nao da pra saber quais GERENTEs vieram da flag e quais ja eram gerentes
        // de verdade. Marca os que entram por PIN (nao tem senha), que e o unico
        // caso em que a flag era usada.
        await queryRunner.query(`
            UPDATE usuarios
            SET pode_acessar_gestor = true, perfil = 'FUNCIONARIO'
            WHERE perfil = 'GERENTE' AND senha_hash IS NULL
        `);

        await queryRunner.query(`ALTER TYPE "public"."usuarios_perfil_enum" RENAME VALUE 'GERENTE' TO 'GESTOR'`);
    }
}
