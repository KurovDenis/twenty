#!/bin/sh
set -e

echo "Starting Twenty server..."

# Enhanced database connection testing
wait_for_database() {
    echo "Waiting for database connection..."
    PGUSER=$(echo $PG_DATABASE_URL | awk -F '//' '{print $2}' | awk -F ':' '{print $1}')
    PGPASS=$(echo $PG_DATABASE_URL | awk -F ':' '{print $3}' | awk -F '@' '{print $1}')
    PGHOST=$(echo $PG_DATABASE_URL | awk -F '@' '{print $2}' | awk -F ':' '{print $1}')
    PGPORT=$(echo $PG_DATABASE_URL | awk -F ':' '{print $4}' | awk -F '/' '{print $1}')
    PGDATABASE=$(echo $PG_DATABASE_URL | awk -F '/' '{print $NF}' | cut -d'?' -f1)
    
    # Wait for database with enhanced retry logic
    for i in $(seq 1 60); do
        if pg_isready -h ${PGHOST} -p ${PGPORT} -U ${PGUSER} -d ${PGDATABASE}; then
            echo "Database is ready!"
            break
        fi
        echo "Database not ready, waiting... ($i/60)"
        sleep 3
    done
    
    # Additional connection test with psql
    echo "Testing database connection with psql..."
    for i in $(seq 1 10); do
        if PGPASSWORD=${PGPASS} psql -h ${PGHOST} -p ${PGPORT} -U ${PGUSER} -d ${PGDATABASE} -c "SELECT 1;" > /dev/null 2>&1; then
            echo "Database connection verified successfully!"
            return 0
        fi
        echo "Connection test failed, retrying... ($i/10)"
        sleep 5
    done
    
    echo "ERROR: Cannot connect to database after 180 seconds"
    exit 1
}

setup_and_migrate_db() {
    if [ "${DISABLE_DB_MIGRATIONS}" = "true" ]; then
        echo "Database setup and migrations are disabled, skipping..."
        return
    fi

    echo "Running database setup and migrations..."
    PGUSER=$(echo $PG_DATABASE_URL | awk -F '//' '{print $2}' | awk -F ':' '{print $1}')
    PGPASS=$(echo $PG_DATABASE_URL | awk -F ':' '{print $3}' | awk -F '@' '{print $1}')
    PGHOST=$(echo $PG_DATABASE_URL | awk -F '@' '{print $2}' | awk -F ':' '{print $1}')
    PGPORT=$(echo $PG_DATABASE_URL | awk -F ':' '{print $4}' | awk -F '/' '{print $1}')
    PGDATABASE=$(echo $PG_DATABASE_URL | awk -F '/' '{print $NF}' | cut -d'?' -f1)

    # Creating the database if it doesn't exist
    db_count=$(PGPASSWORD=${PGPASS} psql -h ${PGHOST} -p ${PGPORT} -U ${PGUSER} -d postgres -tAc "SELECT COUNT(*) FROM pg_database WHERE datname = '${PGDATABASE}'")
    if [ "$db_count" = "0" ]; then
        echo "Database ${PGDATABASE} does not exist, creating..."
        PGPASSWORD=${PGPASS} psql -h ${PGHOST} -p ${PGPORT} -U ${PGUSER} -d postgres -c "CREATE DATABASE \"${PGDATABASE}\""
    fi

    # Run setup and migration scripts
    has_schema=$(PGPASSWORD=${PGPASS} psql -h ${PGHOST} -p ${PGPORT} -U ${PGUSER} -d ${PGDATABASE} -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'core')")
    if [ "$has_schema" = "f" ]; then
        echo "Database appears to be empty, running migrations."
        NODE_OPTIONS="--max-old-space-size=1500" tsx ./scripts/setup-db.ts
        yarn database:migrate:prod
    fi
    
    yarn command:prod upgrade
    echo "Successfully migrated DB!"
}

register_background_jobs() {
    if [ "${DISABLE_CRON_JOBS_REGISTRATION}" = "true" ]; then
        echo "Cron job registration is disabled, skipping..."
        return
    fi
  
    echo "Registering background sync jobs..."
    if yarn command:prod cron:register:all; then
        echo "Successfully registered all background sync jobs!"
    else
        echo "Warning: Failed to register background jobs, but continuing startup..."
    fi
}

# Wait for database before proceeding
wait_for_database

setup_and_migrate_db
register_background_jobs

echo "Database connection verified, starting application..."

# Continue with the original Docker command
exec "$@"
