package database

import (
	"fmt"
	"log"
	"os"

	"github.com/timevault/backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DB is the database connection
var DB *gorm.DB

// Connect establishes a connection to the database
func Connect() error {
	// Get database connection details from environment variables
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	sslMode := os.Getenv("DB_SSL_MODE")

	// Create DSN string
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslMode)

	// Set up logger
	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			LogLevel: logger.Info,
		},
	)

	// Connect to database
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: newLogger,
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Connected to database")
	return nil
}

// Migrate runs database migrations
func Migrate() error {
	// Auto migrate models
	err := DB.AutoMigrate(
		&models.User{},
		&models.Client{},
		&models.Project{},
		&models.Task{},
		&models.TimeEntry{},
		&models.ActiveTimer{},
		&models.Invoice{},
		&models.InvoiceLine{},
		&models.UserSettings{},
		&models.APIToken{},
	)
	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}
	if err := migrateInvoiceIndexes(); err != nil {
		return err
	}
	if err := migrateProjectTasks(); err != nil {
		return err
	}

	log.Println("Database migration completed")
	return nil
}

func migrateProjectTasks() error {
	if err := DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_project_name_active ON tasks (project_id, lower(name)) WHERE deleted_at IS NULL").Error; err != nil {
		return fmt.Errorf("failed to create task uniqueness index: %w", err)
	}
	if err := DB.Exec(`
		INSERT INTO tasks (project_id, name, description, billable, rate, status, created_at, updated_at)
		SELECT p.id, 'General', 'Default task for migrated project time entries', true, p.rate, 'active', NOW(), NOW()
		FROM projects p
		WHERE p.deleted_at IS NULL
		  AND NOT EXISTS (
			SELECT 1 FROM tasks t
			WHERE t.project_id = p.id AND t.deleted_at IS NULL
		  )
	`).Error; err != nil {
		return fmt.Errorf("failed to seed default project tasks: %w", err)
	}
	if err := DB.Exec(`
		UPDATE time_entries te
		SET task_id = t.id
		FROM tasks t
		WHERE te.task_id IS NULL
		  AND te.project_id = t.project_id
		  AND t.name = 'General'
		  AND te.deleted_at IS NULL
	`).Error; err != nil {
		return fmt.Errorf("failed to backfill time entry task ids: %w", err)
	}
	return nil
}

func migrateInvoiceIndexes() error {
	if err := DB.Exec("DROP INDEX IF EXISTS idx_invoices_number").Error; err != nil {
		return fmt.Errorf("failed to replace invoice number index: %w", err)
	}
	if err := DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices (number) WHERE deleted_at IS NULL").Error; err != nil {
		return fmt.Errorf("failed to create invoice number index: %w", err)
	}
	if err := DB.Exec("DROP INDEX IF EXISTS idx_invoices_harvest_id").Error; err != nil {
		return fmt.Errorf("failed to replace invoice harvest id index: %w", err)
	}
	if err := DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_harvest_id ON invoices (harvest_id) WHERE harvest_id IS NOT NULL AND harvest_id <> '' AND deleted_at IS NULL").Error; err != nil {
		return fmt.Errorf("failed to create invoice harvest id index: %w", err)
	}
	return nil
}
