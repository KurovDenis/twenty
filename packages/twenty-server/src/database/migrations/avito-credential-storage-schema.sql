-- =====================================================
-- Avito Credential Storage Database Schema
-- =====================================================
-- Secure storage for Avito API credentials with comprehensive
-- audit trail, encryption metadata, and workflow tracking
-- =====================================================

-- =====================================================
-- 1. AVITO CREDENTIALS TABLE
-- =====================================================
-- Main table for storing encrypted Avito API credentials
CREATE TABLE IF NOT EXISTS avito_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User and workspace associations
    user_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    
    -- Credential data (encrypted)
    client_id_encrypted TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    encryption_key_id VARCHAR(255) NOT NULL, -- Reference to encryption key used
    encryption_algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
    
    -- Access token data (if available)
    access_token_encrypted TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    token_expires_at TIMESTAMP WITH TIME ZONE,
    token_scope TEXT, -- API permissions scope
    
    -- Validation status
    last_validated_at TIMESTAMP WITH TIME ZONE,
    validation_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, valid, invalid, expired
    validation_error_message TEXT,
    validation_attempts INTEGER DEFAULT 0,
    max_validation_attempts INTEGER DEFAULT 3,
    
    -- Security metadata
    created_by UUID NOT NULL, -- User who created these credentials
    created_via VARCHAR(100) NOT NULL DEFAULT 'sgr_workflow', -- How credentials were added
    ip_address INET, -- IP address when credentials were created
    user_agent TEXT, -- User agent when credentials were created
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, suspended, revoked, expired
    is_primary BOOLEAN DEFAULT true, -- Primary credentials for this workspace
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- Credential expiration (if applicable)
    
    -- Constraints
    CONSTRAINT avito_credentials_user_workspace_unique UNIQUE (user_id, workspace_id, is_primary),
    CONSTRAINT avito_credentials_validation_status_check 
        CHECK (validation_status IN ('pending', 'valid', 'invalid', 'expired', 'revoked')),
    CONSTRAINT avito_credentials_status_check 
        CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
    CONSTRAINT avito_credentials_validation_attempts_check 
        CHECK (validation_attempts >= 0 AND validation_attempts <= max_validation_attempts)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_avito_credentials_user_workspace ON avito_credentials(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_avito_credentials_status ON avito_credentials(status);
CREATE INDEX IF NOT EXISTS idx_avito_credentials_validation_status ON avito_credentials(validation_status);
CREATE INDEX IF NOT EXISTS idx_avito_credentials_expires_at ON avito_credentials(expires_at);
CREATE INDEX IF NOT EXISTS idx_avito_credentials_created_at ON avito_credentials(created_at);

-- =====================================================
-- 2. AVITO CREDENTIAL AUDIT TABLE
-- =====================================================
-- Comprehensive audit trail for all credential operations
CREATE TABLE IF NOT EXISTS avito_credential_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to credential record
    credential_id UUID REFERENCES avito_credentials(id) ON DELETE CASCADE,
    
    -- Operation details
    operation VARCHAR(100) NOT NULL, -- create, update, validate, use, revoke, delete, encrypt, decrypt
    operation_category VARCHAR(50) NOT NULL, -- security, maintenance, usage, validation
    operation_status VARCHAR(50) NOT NULL, -- success, failure, partial
    
    -- Change tracking
    old_values JSONB, -- Previous values (encrypted fields excluded)
    new_values JSONB, -- New values (encrypted fields excluded)
    changes_summary TEXT, -- Human-readable summary of changes
    
    -- Context information
    performed_by UUID NOT NULL, -- User who performed the operation
    performed_via VARCHAR(100), -- sgr_workflow, admin_panel, api, system_maintenance
    workflow_context JSONB, -- SGR workflow state and context
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(255), -- For tracking across multiple operations
    session_id VARCHAR(255),
    
    -- Error information (if operation failed)
    error_code VARCHAR(100),
    error_message TEXT,
    error_details JSONB,
    
    -- Timing and performance
    operation_duration_ms INTEGER,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Security flags
    sensitive_operation BOOLEAN DEFAULT false, -- Flags operations involving decryption
    requires_admin_review BOOLEAN DEFAULT false,
    compliance_notes TEXT, -- For regulatory compliance tracking
    
    -- Constraints
    CONSTRAINT avito_audit_operation_check 
        CHECK (operation IN ('create', 'update', 'validate', 'use', 'revoke', 'delete', 'encrypt', 'decrypt', 'refresh', 'rotate')),
    CONSTRAINT avito_audit_category_check 
        CHECK (operation_category IN ('security', 'maintenance', 'usage', 'validation', 'compliance')),
    CONSTRAINT avito_audit_status_check 
        CHECK (operation_status IN ('success', 'failure', 'partial', 'pending'))
);

-- Indexes for audit table
CREATE INDEX IF NOT EXISTS idx_avito_audit_credential_id ON avito_credential_audit(credential_id);
CREATE INDEX IF NOT EXISTS idx_avito_audit_performed_by ON avito_credential_audit(performed_by);
CREATE INDEX IF NOT EXISTS idx_avito_audit_performed_at ON avito_credential_audit(performed_at);
CREATE INDEX IF NOT EXISTS idx_avito_audit_operation ON avito_credential_audit(operation);
CREATE INDEX IF NOT EXISTS idx_avito_audit_operation_status ON avito_credential_audit(operation_status);
CREATE INDEX IF NOT EXISTS idx_avito_audit_sensitive ON avito_credential_audit(sensitive_operation) WHERE sensitive_operation = true;

-- =====================================================
-- 3. AVITO WORKFLOW EXECUTION TABLE
-- =====================================================
-- Track SGR workflow executions for analytics and debugging
CREATE TABLE IF NOT EXISTS avito_workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Workflow identification
    user_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    thread_id VARCHAR(255) NOT NULL,
    execution_id VARCHAR(255) NOT NULL UNIQUE, -- Unique identifier for this execution
    
    -- Workflow status
    current_state VARCHAR(100) NOT NULL,
    final_status VARCHAR(50), -- success, failed, timeout, cancelled
    
    -- Execution tracking
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    total_execution_time_ms INTEGER,
    
    -- Step tracking
    steps_executed JSONB NOT NULL DEFAULT '[]', -- Array of executed steps with timestamps
    current_step_number INTEGER DEFAULT 1,
    total_steps_planned INTEGER,
    
    -- Credential processing
    credentials_extracted BOOLEAN DEFAULT false,
    credentials_validated BOOLEAN DEFAULT false,
    credentials_stored BOOLEAN DEFAULT false,
    credential_id UUID REFERENCES avito_credentials(id), -- Reference to stored credentials
    
    -- Error tracking
    error_count INTEGER DEFAULT 0,
    last_error_type VARCHAR(100),
    last_error_message TEXT,
    recovery_attempts INTEGER DEFAULT 0,
    
    -- Performance metrics
    api_calls_total INTEGER DEFAULT 0,
    api_calls_successful INTEGER DEFAULT 0,
    average_api_response_time_ms INTEGER,
    
    -- Context data
    user_agent TEXT,
    ip_address INET,
    workflow_context JSONB, -- Full workflow context for debugging
    
    -- Metadata
    sgr_version VARCHAR(50), -- Version of SGR system used
    model_version VARCHAR(50), -- AI model version used
    
    -- Constraints
    CONSTRAINT avito_workflow_final_status_check 
        CHECK (final_status IN ('success', 'failed', 'timeout', 'cancelled', 'in_progress'))
);

-- Indexes for workflow executions
CREATE INDEX IF NOT EXISTS idx_avito_workflow_user_workspace ON avito_workflow_executions(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_avito_workflow_thread_id ON avito_workflow_executions(thread_id);
CREATE INDEX IF NOT EXISTS idx_avito_workflow_status ON avito_workflow_executions(final_status);
CREATE INDEX IF NOT EXISTS idx_avito_workflow_started_at ON avito_workflow_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_avito_workflow_completed_at ON avito_workflow_executions(completed_at);

-- =====================================================
-- 4. ENCRYPTION KEY MANAGEMENT TABLE
-- =====================================================
-- Track encryption keys used for credential storage
CREATE TABLE IF NOT EXISTS avito_encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Key identification
    key_id VARCHAR(255) NOT NULL UNIQUE, -- External key identifier
    key_version INTEGER NOT NULL DEFAULT 1,
    
    -- Key metadata
    algorithm VARCHAR(50) NOT NULL DEFAULT 'AES-256-GCM',
    key_source VARCHAR(100) NOT NULL, -- aws_kms, azure_keyvault, local, etc.
    key_purpose VARCHAR(100) NOT NULL DEFAULT 'credential_encryption',
    
    -- Status and lifecycle
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, deprecated, revoked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deprecated_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage tracking
    credentials_encrypted INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Security
    created_by UUID NOT NULL,
    rotation_schedule_days INTEGER DEFAULT 90, -- Days between key rotations
    next_rotation_due TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT avito_encryption_key_status_check 
        CHECK (status IN ('active', 'deprecated', 'revoked'))
);

-- Indexes for encryption keys
CREATE INDEX IF NOT EXISTS idx_avito_encryption_keys_status ON avito_encryption_keys(status);
CREATE INDEX IF NOT EXISTS idx_avito_encryption_keys_rotation_due ON avito_encryption_keys(next_rotation_due);

-- =====================================================
-- 5. COMPLIANCE AND SECURITY VIEWS
-- =====================================================

-- View for credential security overview
CREATE OR REPLACE VIEW avito_credential_security_overview AS
SELECT 
    ac.id,
    ac.user_id,
    ac.workspace_id,
    ac.validation_status,
    ac.status,
    ac.created_at,
    ac.last_validated_at,
    ac.last_used_at,
    aek.algorithm as encryption_algorithm,
    aek.key_version as encryption_key_version,
    aek.status as encryption_key_status,
    CASE 
        WHEN ac.token_expires_at < NOW() THEN 'expired'
        WHEN ac.token_expires_at < NOW() + INTERVAL '7 days' THEN 'expiring_soon'
        ELSE 'valid'
    END as token_status,
    (SELECT COUNT(*) FROM avito_credential_audit aca 
     WHERE aca.credential_id = ac.id 
     AND aca.sensitive_operation = true) as sensitive_operations_count
FROM avito_credentials ac
LEFT JOIN avito_encryption_keys aek ON ac.encryption_key_id = aek.key_id
WHERE ac.status = 'active';

-- View for audit trail summary
CREATE OR REPLACE VIEW avito_audit_summary AS
SELECT 
    DATE_TRUNC('day', performed_at) as audit_date,
    operation,
    operation_category,
    operation_status,
    COUNT(*) as operation_count,
    COUNT(DISTINCT performed_by) as unique_users,
    COUNT(DISTINCT credential_id) as affected_credentials,
    AVG(operation_duration_ms) as avg_duration_ms
FROM avito_credential_audit
WHERE performed_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', performed_at), operation, operation_category, operation_status
ORDER BY audit_date DESC, operation_count DESC;

-- View for workflow performance metrics
CREATE OR REPLACE VIEW avito_workflow_metrics AS
SELECT 
    DATE_TRUNC('hour', started_at) as execution_hour,
    final_status,
    COUNT(*) as execution_count,
    AVG(total_execution_time_ms) as avg_execution_time_ms,
    AVG(api_calls_total) as avg_api_calls,
    AVG(CASE WHEN api_calls_total > 0 THEN api_calls_successful::float / api_calls_total ELSE NULL END) as api_success_rate,
    SUM(error_count) as total_errors,
    COUNT(DISTINCT user_id) as unique_users
FROM avito_workflow_executions
WHERE started_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', started_at), final_status
ORDER BY execution_hour DESC;

-- =====================================================
-- 6. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_avito_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_avito_credentials_updated_at
    BEFORE UPDATE ON avito_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_avito_credentials_updated_at();

-- Trigger to create audit record on credential changes
CREATE OR REPLACE FUNCTION create_avito_credential_audit()
RETURNS TRIGGER AS $$
DECLARE
    operation_type VARCHAR(50);
    old_vals JSONB := '{}';
    new_vals JSONB := '{}';
BEGIN
    -- Determine operation type
    IF TG_OP = 'INSERT' THEN
        operation_type := 'create';
        new_vals := to_jsonb(NEW) - 'client_id_encrypted' - 'client_secret_encrypted' - 'access_token_encrypted';
    ELSIF TG_OP = 'UPDATE' THEN
        operation_type := 'update';
        old_vals := to_jsonb(OLD) - 'client_id_encrypted' - 'client_secret_encrypted' - 'access_token_encrypted';
        new_vals := to_jsonb(NEW) - 'client_id_encrypted' - 'client_secret_encrypted' - 'access_token_encrypted';
    ELSIF TG_OP = 'DELETE' THEN
        operation_type := 'delete';
        old_vals := to_jsonb(OLD) - 'client_id_encrypted' - 'client_secret_encrypted' - 'access_token_encrypted';
    END IF;

    -- Insert audit record
    INSERT INTO avito_credential_audit (
        credential_id,
        operation,
        operation_category,
        operation_status,
        old_values,
        new_values,
        performed_by,
        performed_via,
        changes_summary
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        operation_type,
        'maintenance',
        'success',
        old_vals,
        new_vals,
        COALESCE(NEW.created_by, OLD.created_by),
        'database_trigger',
        operation_type || ' operation on credential ' || COALESCE(NEW.id, OLD.id)
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_avito_credential_audit
    AFTER INSERT OR UPDATE OR DELETE ON avito_credentials
    FOR EACH ROW
    EXECUTE FUNCTION create_avito_credential_audit();

-- =====================================================
-- 7. SECURITY POLICIES (Row Level Security)
-- =====================================================

-- Enable RLS on credentials table
ALTER TABLE avito_credentials ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own workspace credentials
CREATE POLICY avito_credentials_workspace_policy ON avito_credentials
    FOR ALL
    USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = current_setting('app.current_user_id')::uuid
    ));

-- Policy: Audit records are read-only for regular users
ALTER TABLE avito_credential_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY avito_audit_read_only_policy ON avito_credential_audit
    FOR SELECT
    USING (credential_id IN (
        SELECT id FROM avito_credentials 
        WHERE workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = current_setting('app.current_user_id')::uuid
        )
    ));

-- =====================================================
-- 8. SAMPLE DATA AND TESTING QUERIES
-- =====================================================

-- Sample encryption key (for testing only)
INSERT INTO avito_encryption_keys (
    key_id,
    key_version,
    algorithm,
    key_source,
    created_by,
    next_rotation_due
) VALUES (
    'test-key-001',
    1,
    'AES-256-GCM',
    'local',
    '00000000-0000-0000-0000-000000000000',
    NOW() + INTERVAL '90 days'
) ON CONFLICT (key_id) DO NOTHING;

-- =====================================================
-- NOTES AND MAINTENANCE
-- =====================================================

/*
IMPORTANT SECURITY CONSIDERATIONS:

1. ENCRYPTION:
   - All sensitive credential data (client_id, client_secret, access_token) is stored encrypted
   - Encryption keys are managed separately and should be rotated regularly
   - Consider using external key management services (AWS KMS, Azure Key Vault)

2. ACCESS CONTROL:
   - Row Level Security (RLS) ensures users can only access their workspace data
   - Audit table provides comprehensive tracking of all operations
   - Sensitive operations are flagged for additional review

3. COMPLIANCE:
   - Audit trail supports regulatory compliance requirements
   - Data retention policies should be implemented
   - Regular security reviews should be conducted

4. PERFORMANCE:
   - Indexes are optimized for common query patterns
   - Consider partitioning audit table by date for large deployments
   - Monitor query performance and adjust indexes as needed

5. MAINTENANCE:
   - Regular cleanup of old audit records
   - Key rotation procedures
   - Credential validation and refresh workflows
   - Backup and recovery procedures

RECOMMENDED MAINTENANCE QUERIES:

-- Clean up old audit records (older than 1 year)
DELETE FROM avito_credential_audit 
WHERE performed_at < NOW() - INTERVAL '1 year';

-- Find credentials that need validation
SELECT * FROM avito_credentials 
WHERE last_validated_at < NOW() - INTERVAL '7 days'
AND status = 'active';

-- Check for encryption keys that need rotation
SELECT * FROM avito_encryption_keys 
WHERE next_rotation_due < NOW()
AND status = 'active';

-- Monitor credential usage patterns
SELECT 
    workspace_id,
    COUNT(*) as credential_count,
    AVG(validation_attempts) as avg_validation_attempts,
    MAX(last_used_at) as last_activity
FROM avito_credentials 
WHERE status = 'active'
GROUP BY workspace_id;
*/