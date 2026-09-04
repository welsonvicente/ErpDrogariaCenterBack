import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFormaPagamento1788390121303 implements MigrationInterface {
    name = 'AddFormaPagamento1788390121303'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."despesas_forma_pagamento_enum" AS ENUM('DINHEIRO', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'PIX', 'BOLETO', 'OUTRO')`);
        await queryRunner.query(`ALTER TABLE "despesas" ADD "forma_pagamento" "public"."despesas_forma_pagamento_enum" NOT NULL DEFAULT 'DINHEIRO'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "despesas" DROP COLUMN "forma_pagamento"`);
        await queryRunner.query(`DROP TYPE "public"."despesas_forma_pagamento_enum"`);
    }

}
