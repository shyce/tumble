#!/bin/bash

# Quick utility for user management in Tumble backend

case "$1" in
    "hash")
        if [ -z "$2" ]; then
            echo "Usage: $0 hash <password>"
            exit 1
        fi
        go run cmd/generate_users.go hash "$2"
        ;;
    
    "create-user")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 create-user <email> <password> [role] [first_name] [last_name]"
            echo "Example: $0 create-user test@example.com mypassword customer John Doe"
            exit 1
        fi
        
        EMAIL="$2"
        PASSWORD="$3"
        ROLE="${4:-customer}"
        FIRST_NAME="${5:-Test}"
        LAST_NAME="${6:-User}"
        
        # Generate hash
        HASH=$(go run cmd/generate_users.go hash "$PASSWORD" | grep "Hash:" | cut -d' ' -f2)
        
        # Insert into database
        docker compose exec postgres psql -U tumble -d tumble -c "
        INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified_at) 
        VALUES ('$EMAIL', '$HASH', '$FIRST_NAME', '$LAST_NAME', '$ROLE', CURRENT_TIMESTAMP);
        "
        
        echo "User created successfully:"
        echo "Email: $EMAIL"
        echo "Password: $PASSWORD"
        echo "Role: $ROLE"
        ;;
    
    "list-users")
        docker compose exec postgres psql -U tumble -d tumble -c "
        SELECT id, email, first_name, last_name, role, email_verified_at, created_at 
        FROM users 
        ORDER BY created_at DESC;
        "
        ;;
    
    "test-login")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo "Usage: $0 test-login <email> <password>"
            exit 1
        fi
        
        EMAIL="$2"
        PASSWORD="$3"
        
        echo "Testing login for $EMAIL..."
        curl -X POST http://localhost:8082/api/auth/login \
             -H "Content-Type: application/json" \
             -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
             | jq '.'
        ;;
    
    "reset-test-data")
        echo "Resetting test database with fresh migrations..."
        docker compose exec postgres psql -U tumble -d tumble_test -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
        docker compose exec server sh -c "cd /app && go run migrate.go"
        echo "Test database reset complete."
        ;;
    
    *)
        echo "Tumble User Management Helper"
        echo "Usage: $0 <command> [args...]"
        echo ""
        echo "Commands:"
        echo "  hash <password>                    - Generate bcrypt hash"
        echo "  create-user <email> <password> [role] [first] [last] - Create new user"
        echo "  list-users                         - List all users"
        echo "  test-login <email> <password>      - Test login API"
        echo "  reset-test-data                    - Reset test database"
        echo ""
        echo "Default test users (after migration):"
        echo "  admin@tumble.com / admin123 (admin)"
        echo "  driver@tumble.com / driver123 (driver)"
        echo "  customer@tumble.com / customer123 (customer)"
        ;;
esac