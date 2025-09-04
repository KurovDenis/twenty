const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'twenty',
  user: 'postgres',
  password: 'postgres',
});

async function testDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check specific user test@example.com
    const userResult = await client.query(`
      SELECT id, email, "firstName", "lastName", "passwordHash", "isEmailVerified", "createdAt"
      FROM core.user 
      WHERE email = 'test@example.com'
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ User test@example.com not found');
      return;
    }

    const user = userResult.rows[0];
    console.log('🔍 User test@example.com:', {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      hasPasswordHash: !!user.passwordHash,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt
    });

    // Check ALL userWorkspace links for this user (including deleted ones)
    const allUserWorkspacesResult = await client.query(`
      SELECT 
        uw.id,
        uw."userId",
        uw."workspaceId",
        uw."deletedAt",
        w.subdomain,
        w."displayName",
        w."activationStatus",
        w."createdAt"
      FROM core."userWorkspace" uw
      JOIN core.workspace w ON uw."workspaceId" = w.id
      WHERE uw."userId" = $1
      ORDER BY w."createdAt" DESC
    `, [user.id]);

    console.log('📊 ALL user workspaces (including deleted):', allUserWorkspacesResult.rows);

    // Check active workspaces (not deleted)
    const activeWorkspaces = allUserWorkspacesResult.rows.filter(uw => !uw.deletedAt);
    console.log('✅ Active workspaces count:', activeWorkspaces.length);

    // Check if there are any workspaces that might be linked to this user but not through userWorkspace
    const allWorkspacesResult = await client.query(`
      SELECT 
        w.id,
        w.subdomain,
        w."displayName",
        w."activationStatus",
        w."createdAt"
      FROM core.workspace w
      ORDER BY w."createdAt" DESC
      LIMIT 10
    `);

    console.log('📊 All workspaces in database:', allWorkspacesResult.rows);

    // Check MAX_WORKSPACES_PER_USER setting
    const configResult = await client.query(`
      SELECT "key", "value" 
      FROM core."keyValuePair" 
      WHERE "key" = 'MAX_WORKSPACES_PER_USER'
    `);

    console.log('⚙️ MAX_WORKSPACES_PER_USER config:', configResult.rows);

    // Simulate the checkUserWorkspaceLimit logic
    console.log('🔍 Simulating checkUserWorkspaceLimit logic:');
    console.log('  - User has active workspaces:', activeWorkspaces.length);
    console.log('  - MAX_WORKSPACES_PER_USER from config:', configResult.rows.length > 0 ? configResult.rows[0].value : 'NOT FOUND');
    console.log('  - Would this block creation?', activeWorkspaces.length >= (configResult.rows.length > 0 ? parseInt(configResult.rows[0].value) : 5));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testDatabase();
