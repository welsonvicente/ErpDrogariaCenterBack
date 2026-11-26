import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Aparência por campanha (fundos, cores, posições e logomarca padrão de Story/Panfleto/Tablet/
 * Importar). As campanhas que já existem ficam com o que estava nas preferências da organização —
 * a "Campanha atual" continua exatamente igual; campanhas novas não herdam os fundos dela.
 */
export class AddAparenciaCampanhas1795300000001 implements MigrationInterface {
    name = 'AddAparenciaCampanhas1795300000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campanhas_cartaz" ADD "aparencia" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`
            UPDATE "campanhas_cartaz" c SET "aparencia" = COALESCE((
                SELECT jsonb_object_agg(p."chave"::text, p."valor")
                FROM "preferencias_cartaz" p
                WHERE p."organizacao_id" = c."organizacao_id"
                  AND p."chave" IN ('story', 'panfleto', 'planilha', 'logo_story')
            ), '{}'::jsonb)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "campanhas_cartaz" DROP COLUMN "aparencia"`);
    }
}
