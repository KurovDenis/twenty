import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class EnableAIForAllWorkspaces1752070094778
  implements MigrationInterface
{
  name = 'EnableAIForAllWorkspaces1752070094778';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Включаем AI Feature Flag для всех существующих workspace
    await queryRunner.query(`
      INSERT INTO "core"."featureFlag" ("key", "workspaceId", "value", "createdAt", "updatedAt")
      SELECT 
        'IS_AI_ENABLED' as "key",
        w.id as "workspaceId",
        true as "value",
        NOW() as "createdAt",
        NOW() as "updatedAt"
      FROM "core"."workspace" w
      WHERE w."deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "core"."featureFlag" ff 
        WHERE ff."key" = 'IS_AI_ENABLED' 
        AND ff."workspaceId" = w.id
      )
    `);

    // Создаем AI Agent для workspace, у которых его нет
    await queryRunner.query(`
      INSERT INTO "core"."agent" ("id", "name", "description", "prompt", "modelId", "workspaceId", "createdAt", "updatedAt")
      SELECT 
        gen_random_uuid() as "id",
        'ai-assistant' as "name",
        'Default AI Assistant for this workspace' as "description",
        'You are a helpful AI assistant for this workspace. Help users with their tasks, provide insights about their data, and guide them through workflows. Be concise but thorough in your responses. You can help with data analysis, workflow guidance, task management, and general workspace assistance.' as "prompt",
        'auto' as "modelId",
        w.id as "workspaceId",
        NOW() as "createdAt",
        NOW() as "updatedAt"
      FROM "core"."workspace" w
      WHERE w."deletedAt" IS NULL
      AND w."defaultAgentId" IS NULL
      AND EXISTS (
        SELECT 1 FROM "core"."featureFlag" ff 
        WHERE ff."key" = 'IS_AI_ENABLED' 
        AND ff."workspaceId" = w.id
        AND ff."value" = true
      )
    `);

    // Устанавливаем defaultAgentId для workspace, у которых его нет
    await queryRunner.query(`
      UPDATE "core"."workspace" w
      SET "defaultAgentId" = a.id
      FROM "core"."agent" a
      WHERE w."deletedAt" IS NULL
      AND w."defaultAgentId" IS NULL
      AND a."workspaceId" = w.id
      AND a."name" = 'ai-assistant'
      AND EXISTS (
        SELECT 1 FROM "core"."featureFlag" ff 
        WHERE ff."key" = 'IS_AI_ENABLED' 
        AND ff."workspaceId" = w.id
        AND ff."value" = true
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Удаляем AI Feature Flag
    await queryRunner.query(`
      DELETE FROM "core"."featureFlag" 
      WHERE "key" = 'IS_AI_ENABLED'
    `);

    // Удаляем AI Agent
    await queryRunner.query(`
      DELETE FROM "core"."agent" 
      WHERE "name" = 'ai-assistant'
    `);

    // Сбрасываем defaultAgentId
    await queryRunner.query(`
      UPDATE "core"."workspace" 
      SET "defaultAgentId" = NULL
      WHERE "defaultAgentId" IN (
        SELECT id FROM "core"."agent" WHERE "name" = 'ai-assistant'
      )
    `);
  }
}
