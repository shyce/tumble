package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func runMigrations(db *sql.DB) error {
	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("could not create postgres driver: %v", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://migrations",
		"postgres", driver)
	if err != nil {
		return fmt.Errorf("could not create migration instance: %v", err)
	}

	err = m.Up()
	if err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("could not run migrations: %v", err)
	}

	// Only log migration messages if not in test mode
	isTest := os.Getenv("GO_ENV") == "test" || os.Getenv("TEST_DB_NAME") != ""
	
	if err == migrate.ErrNoChange {
		if !isTest {
			log.Println("No new migrations to run")
		}
	} else {
		if !isTest {
			log.Println("Migrations completed successfully")
		}
	}

	return nil
}