package main

import (
	"fmt"
	"log"
	"os"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run generate_users.go <command>")
		fmt.Println("Commands:")
		fmt.Println("  hash <password>    - Generate bcrypt hash for password")
		fmt.Println("  seed-users         - Generate SQL for seed users")
		return
	}

	command := os.Args[1]

	switch command {
	case "hash":
		if len(os.Args) < 3 {
			fmt.Println("Usage: go run generate_users.go hash <password>")
			return
		}
		password := os.Args[2]
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("Password: %s\n", password)
		fmt.Printf("Hash: %s\n", string(hash))

	case "seed-users":
		generateSeedUsers()

	default:
		fmt.Printf("Unknown command: %s\n", command)
	}
}

func generateSeedUsers() {
	users := []struct {
		email     string
		password  string
		firstName string
		lastName  string
		phone     string
		role      string
	}{
		{"admin@tumble.com", "admin123", "Admin", "User", "", "admin"},
		{"driver@tumble.com", "driver123", "John", "Driver", "555-0123", "driver"},
		{"customer@tumble.com", "customer123", "Jane", "Customer", "555-0456", "customer"},
	}

	fmt.Println("-- Insert sample users with correct password hashes")
	for _, user := range users {
		hash, err := bcrypt.GenerateFromPassword([]byte(user.password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Error generating hash for %s: %v", user.email, err)
			continue
		}

		if user.phone != "" {
			fmt.Printf("INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified_at) VALUES\n")
			fmt.Printf("('%s', '%s', '%s', '%s', '%s', '%s', CURRENT_TIMESTAMP);\n", 
				user.email, string(hash), user.firstName, user.lastName, user.phone, user.role)
		} else {
			fmt.Printf("INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified_at) VALUES\n")
			fmt.Printf("('%s', '%s', '%s', '%s', '%s', CURRENT_TIMESTAMP);\n", 
				user.email, string(hash), user.firstName, user.lastName, user.role)
		}
		fmt.Printf("-- Password for %s: %s\n\n", user.email, user.password)
	}
}