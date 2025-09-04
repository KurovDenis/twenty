const { Client } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './packages/twenty-server/.env' });

async function debugWorkspaceLimit() {
  const client = new Client({
    connectionString: process.env.PG_DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database successfully');
    
    // Check current config
    console.log('\n=== Configuration ===');
    console.log('MAX_WORKSPACES_PER_USER:', process.env.MAX_WORKSPACES_PER_USER);
    console.log('IS_MULTIWORKSPACE_ENABLED:', process.env.IS_MULTIWORKSPACE_ENABLED);
    
    // First check what schemas exist
    console.log('\n=== Available Schemas ===');
    const schemaQuery = `SELECT schema_name FROM information_schema.schemata ORDER BY schema_name`;
    const schemas = await client.query(schemaQuery);
    console.log('Available schemas:', schemas.rows.map(r => r.schema_name));
    
    // Check what tables exist in core schema
    console.log('\n=== Tables in core schema ===');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'core' 
      ORDER BY table_name
    `;
    const tables = await client.query(tablesQuery);
    console.log('Tables in core schema:', tables.rows.map(r => r.table_name));
    
    // Try to find user-related tables
    console.log('\n=== User-related tables ===');
    const userTablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'core' AND table_name LIKE '%user%'
      ORDER BY table_name
    `;
    const userTables = await client.query(userTablesQuery);
    console.log('User-related tables:', userTables.rows.map(r => r.table_name));
    
    // Now try with actual table names if they exist
    if (userTables.rows.some(r => r.table_name === 'user')) {
      console.log('\n=== User Workspace Counts ===');
      const userWorkspaceQuery = `
        SELECT 
          u.email,
          COUNT(uw.id) as workspace_count
        FROM core."user" u
        LEFT JOIN core."userWorkspace" uw ON u.id = uw."userId" AND uw."deletedAt" IS NULL
        GROUP BY u.email
        ORDER BY workspace_count DESC;
      `;
      
      const result = await client.query(userWorkspaceQuery);
    
      if (result.rows.length === 0) {
        console.log('No users found in database');
      } else {
        console.log('User workspace counts:');
        result.rows.forEach(row => {
          console.log(`  ${row.email}: ${row.workspace_count} workspaces`);
        });
      }
    } else {
      console.log('User table not found with expected name');
    }
    
    // Check total workspace count
    try {
      const workspaceCountQuery = 'SELECT COUNT(*) as total_workspaces FROM core."workspace"';
      const workspaceResult = await client.query(workspaceCountQuery);
      console.log(`\nTotal workspaces in database: ${workspaceResult.rows[0].total_workspaces}`);
    } catch (err) {
      console.log('\nWorkspace table query failed:', err.message);
    }
    
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await client.end();
  }
}

debugWorkspaceLimit();