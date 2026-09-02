import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1788306845396 implements MigrationInterface {
    name = 'InitialSchema1788306845396'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "organizacoes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nome" character varying(120) NOT NULL, "slug" character varying(60) NOT NULL, "ativo" boolean NOT NULL DEFAULT true, "criado_em" TIMESTAMP NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_46583a01fed194ab0272fb956ea" UNIQUE ("slug"), CONSTRAINT "PK_aaa7e243c35cfda8fa5c7d116de" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."usuarios_perfil_enum" AS ENUM('ADMIN', 'GESTOR', 'FUNCIONARIO')`);
        await queryRunner.query(`CREATE TABLE "usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "nome" character varying(120) NOT NULL, "email" character varying(160), "senha_hash" character varying, "codigo" character varying(12), "pin_hash" character varying, "icone" character varying NOT NULL DEFAULT '🙂', "perfil" "public"."usuarios_perfil_enum" NOT NULL DEFAULT 'FUNCIONARIO', "ativo" boolean NOT NULL DEFAULT true, "criado_em" TIMESTAMP NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uk_usuarios_organizacao_codigo" UNIQUE ("organizacao_id", "codigo"), CONSTRAINT "uk_usuarios_organizacao_email" UNIQUE ("organizacao_id", "email"), CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "despesas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "data" date NOT NULL, "valor" numeric(12,2) NOT NULL, "descricao" character varying(500), "usuario_id" uuid NOT NULL, "categoria_id" uuid NOT NULL, "criado_em" TIMESTAMP NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e56af303d820f51a6e6a007b380" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "categorias" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizacao_id" uuid NOT NULL, "nome" character varying(120) NOT NULL, "icone" character varying NOT NULL DEFAULT '✳️', "ordem" integer NOT NULL DEFAULT '0', "ativo" boolean NOT NULL DEFAULT true, "criado_em" TIMESTAMP NOT NULL DEFAULT now(), "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "uk_categorias_organizacao_nome" UNIQUE ("organizacao_id", "nome"), CONSTRAINT "PK_3886a26251605c571c6b4f861fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD CONSTRAINT "FK_db17af1d956b8143073ff643e74" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "despesas" ADD CONSTRAINT "FK_aba587b5afeab7c66325075c2eb" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "despesas" ADD CONSTRAINT "FK_177aa02953cb63a88dd61ba66b3" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "despesas" ADD CONSTRAINT "FK_09ac33dcad7a16504745913777a" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categorias" ADD CONSTRAINT "FK_870d98a12020396f755b43f202b" FOREIGN KEY ("organizacao_id") REFERENCES "organizacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categorias" DROP CONSTRAINT "FK_870d98a12020396f755b43f202b"`);
        await queryRunner.query(`ALTER TABLE "despesas" DROP CONSTRAINT "FK_09ac33dcad7a16504745913777a"`);
        await queryRunner.query(`ALTER TABLE "despesas" DROP CONSTRAINT "FK_177aa02953cb63a88dd61ba66b3"`);
        await queryRunner.query(`ALTER TABLE "despesas" DROP CONSTRAINT "FK_aba587b5afeab7c66325075c2eb"`);
        await queryRunner.query(`ALTER TABLE "usuarios" DROP CONSTRAINT "FK_db17af1d956b8143073ff643e74"`);
        await queryRunner.query(`DROP TABLE "categorias"`);
        await queryRunner.query(`DROP TABLE "despesas"`);
        await queryRunner.query(`DROP TABLE "usuarios"`);
        await queryRunner.query(`DROP TYPE "public"."usuarios_perfil_enum"`);
        await queryRunner.query(`DROP TABLE "organizacoes"`);
    }

}
