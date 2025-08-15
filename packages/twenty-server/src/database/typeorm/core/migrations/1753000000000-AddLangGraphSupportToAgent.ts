import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLangGraphSupportToAgent1753000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add LangGraph support to agent table
    await queryRunner.query(
      `ALTER TABLE "core"."agent" ADD "agentType" character varying DEFAULT 'standard'`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."agent" ADD "langgraphConfig" jsonb`,
    );
    
    // Create LangGraph state table
    await queryRunner.query(`
      CREATE TABLE "core"."langgraph_state" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "threadId" uuid NOT NULL,
        "agentId" uuid NOT NULL,
        "workspaceId" uuid NOT NULL,
        "state" jsonb NOT NULL,
        "longTermMemory" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "expiresAt" TIMESTAMP,
        CONSTRAINT "PK_langgraph_state" PRIMARY KEY ("id")
      )
    `);
    
    // Create indexes for performance
    await queryRunner.query(
      `CREATE INDEX "IDX_langgraph_state_thread_id" ON "core"."langgraph_state" ("threadId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_langgraph_state_workspace" ON "core"."langgraph_state" ("workspaceId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_langgraph_state_agent" ON "core"."langgraph_state" ("agentId")`
    );
    
    // Unique index for active state per thread
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UNIQ_langgraph_state_thread_active" ON "core"."langgraph_state" ("threadId") WHERE "isActive" = true`
    );
    
    // Partial index for active states
    await queryRunner.query(
      `CREATE INDEX "IDX_langgraph_state_active" ON "core"."langgraph_state" ("isActive") WHERE "isActive" = true`
    );
    
    // Index for expiration cleanup
    await queryRunner.query(
      `CREATE INDEX "IDX_langgraph_state_expires" ON "core"."langgraph_state" ("expiresAt") WHERE "expiresAt" IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_langgraph_state_expires"`);
    await queryRunner.query(`DROP INDEX "IDX_langgraph_state_active"`);
    await queryRunner.query(`DROP INDEX "UNIQ_langgraph_state_thread_active"`);
    await queryRunner.query(`DROP INDEX "IDX_langgraph_state_agent"`);
    await queryRunner.query(`DROP INDEX "IDX_langgraph_state_workspace"`);
    await queryRunner.query(`DROP INDEX "IDX_langgraph_state_thread_id"`);
    
    // Drop table
    await queryRunner.query(`DROP TABLE "core"."langgraph_state"`);
    
    // Remove columns from agent table
    await queryRunner.query(`ALTER TABLE "core"."agent" DROP COLUMN "langgraphConfig"`);
    await queryRunner.query(`ALTER TABLE "core"."agent" DROP COLUMN "agentType"`);
  }
}
