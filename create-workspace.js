const { Client } = require('pg');

async function createWorkspace() {
  console.log('\n=== Creating Workspace for ff@ddsd.ru ===');
  
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'twenty'
  });

  try {
    await client.connect();
    console.log('✅ Connected to twenty database');

    // Get user ff@ddsd.ru
    const userResult = await client.query(`
      SELECT id, email FROM core.user 
      WHERE email = 'ff@ddsd.ru' AND "deletedAt" IS NULL
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User ff@ddsd.ru not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('Found user:', user);

    // Create workspace with PENDING_CREATION status (no default role required)
    const workspaceId = '550e8400-e29b-41d4-a716-446655440000'; // Fixed UUID
    const workspaceResult = await client.query(`
      INSERT INTO core.workspace (
        id, subdomain, "displayName", "activationStatus", 
        "isGoogleAuthEnabled", "isPasswordAuthEnabled", "isMicrosoftAuthEnabled",
        "isPublicInviteLinkEnabled", "metadataVersion", "databaseUrl", "databaseSchema",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      ) RETURNING id, subdomain, "activationStatus"
    `, [
      workspaceId,
      'ff-workspace',
      'FF Workspace',
      'PENDING_CREATION', // Start with pending creation
      true,
      true,
      true,
      true,
      1,
      '',
      ''
    ]);
    
    console.log('✅ Created workspace:', workspaceResult.rows[0]);

    // Create default role for workspace
    const defaultRoleId = '660e8400-e29b-41d4-a716-446655440000'; // Fixed UUID
    const roleResult = await client.query(`
      INSERT INTO core.role (
        id, label, "canUpdateAllSettings", description, "workspaceId",
        "canReadAllObjectRecords", "canUpdateAllObjectRecords", 
        "canSoftDeleteAllObjectRecords", "canDestroyAllObjectRecords",
        "canAccessAllTools", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
      ) RETURNING id, label, "workspaceId"
    `, [
      defaultRoleId,
      'Admin',
      true,
      'Default admin role',
      workspaceId,
      true,
      true,
      true,
      true,
      true
    ]);
    
    console.log('✅ Created default role:', roleResult.rows[0]);

    // Update workspace with default role and activate it
    await client.query(`
      UPDATE core.workspace 
      SET "defaultRoleId" = $1, "activationStatus" = 'ACTIVE'
      WHERE id = $2
    `, [defaultRoleId, workspaceId]);
    
    console.log('✅ Updated workspace with default role and activated it');

    // Create userWorkspace link
    const userWorkspaceResult = await client.query(`
      INSERT INTO core."userWorkspace" (
        "userId", "workspaceId", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, NOW(), NOW()
      ) RETURNING id, "userId", "workspaceId"
    `, [user.id, workspaceId]);
    
    console.log('✅ Created userWorkspace link:', userWorkspaceResult.rows[0]);

    // Assign role to user
    const roleTargetResult = await client.query(`
      INSERT INTO core."roleTargets" (
        "roleId", "userWorkspaceId", "workspaceId", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, NOW(), NOW()
      ) RETURNING id, "roleId", "userWorkspaceId"
    `, [defaultRoleId, userWorkspaceResult.rows[0].id, workspaceId]);
    
    console.log('✅ Assigned role to user:', roleTargetResult.rows[0]);

    // Verify the link
    const verifyResult = await client.query(`
      SELECT 
        u.email,
        w.subdomain,
        w."activationStatus",
        uw.id as link_id,
        r.label as role_label
      FROM core.user u
      JOIN core."userWorkspace" uw ON u.id = uw."userId"
      JOIN core.workspace w ON uw."workspaceId" = w.id
      JOIN core."roleTargets" rt ON uw.id = rt."userWorkspaceId"
      JOIN core.role r ON rt."roleId" = r.id
      WHERE u.email = 'ff@ddsd.ru'
    `);
    
    console.log('✅ Verification result:', verifyResult.rows[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createWorkspace();
