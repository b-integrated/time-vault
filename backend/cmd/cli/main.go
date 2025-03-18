package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/spf13/cobra"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var rootCmd = &cobra.Command{
	Use:   "timevault-cli",
	Short: "TimeVault CLI for user management",
	Long:  `A command-line interface for managing TimeVault users, including adding users and resetting passwords.`,
}

var listUsersCmd = &cobra.Command{
	Use:   "list-users",
	Short: "List all users",
	Run: func(cmd *cobra.Command, args []string) {
		var users []models.User
		if err := database.DB.Find(&users).Error; err != nil {
			log.Fatalf("Failed to retrieve users: %v", err)
		}

		fmt.Println("Users:")
		fmt.Println("ID\tEmail\tName\tRole\t2FA Enabled")
		fmt.Println("--\t-----\t----\t----\t----------")
		for _, user := range users {
			fmt.Printf("%d\t%s\t%s\t%s\t%t\n", user.ID, user.Email, user.Name, user.Role, user.TwoFactorEnabled)
		}
	},
}

var addUserCmd = &cobra.Command{
	Use:   "add-user",
	Short: "Add a new user",
	Run: func(cmd *cobra.Command, args []string) {
		name, _ := cmd.Flags().GetString("name")
		email, _ := cmd.Flags().GetString("email")
		password, _ := cmd.Flags().GetString("password")
		role, _ := cmd.Flags().GetString("role")
		twoFactorEnabled, _ := cmd.Flags().GetBool("two-factor")

		if name == "" || email == "" || password == "" {
			log.Fatalf("Name, email, and password are required")
		}

		// Check if user already exists
		var existingUser models.User
		result := database.DB.Where("email = ?", email).First(&existingUser)
		if result.RowsAffected > 0 {
			log.Fatalf("User with email %s already exists", email)
		}

		// Hash password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash password: %v", err)
		}

		// Create user
		user := models.User{
			Name:             name,
			Email:            email,
			Password:         string(hashedPassword),
			Role:             role,
			TwoFactorEnabled: twoFactorEnabled,
		}

		if err := database.DB.Create(&user).Error; err != nil {
			log.Fatalf("Failed to create user: %v", err)
		}

		fmt.Printf("User created successfully: %s (%s)\n", user.Name, user.Email)
	},
}

var resetPasswordCmd = &cobra.Command{
	Use:   "reset-password",
	Short: "Reset a user's password",
	Run: func(cmd *cobra.Command, args []string) {
		email, _ := cmd.Flags().GetString("email")
		newPassword, _ := cmd.Flags().GetString("new-password")

		if email == "" || newPassword == "" {
			log.Fatalf("Email and new password are required")
		}

		// Find user
		var user models.User
		result := database.DB.Where("email = ?", email).First(&user)
		if result.Error != nil {
			if result.Error == gorm.ErrRecordNotFound {
				log.Fatalf("User with email %s not found", email)
			}
			log.Fatalf("Failed to find user: %v", result.Error)
		}

		// Hash new password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash password: %v", err)
		}

		// Update user's password
		user.Password = string(hashedPassword)
		if err := database.DB.Save(&user).Error; err != nil {
			log.Fatalf("Failed to update user's password: %v", err)
		}

		fmt.Printf("Password reset successfully for user: %s\n", user.Email)
	},
}

var getUserCmd = &cobra.Command{
	Use:   "get-user",
	Short: "Get user details by email",
	Run: func(cmd *cobra.Command, args []string) {
		email, _ := cmd.Flags().GetString("email")

		if email == "" {
			log.Fatalf("Email is required")
		}

		// Find user
		var user models.User
		result := database.DB.Where("email = ?", email).First(&user)
		if result.Error != nil {
			if result.Error == gorm.ErrRecordNotFound {
				log.Fatalf("User with email %s not found", email)
			}
			log.Fatalf("Failed to find user: %v", result.Error)
		}

		fmt.Println("User details:")
		fmt.Printf("ID: %d\n", user.ID)
		fmt.Printf("Name: %s\n", user.Name)
		fmt.Printf("Email: %s\n", user.Email)
		fmt.Printf("Role: %s\n", user.Role)
		fmt.Printf("2FA Enabled: %t\n", user.TwoFactorEnabled)
		fmt.Printf("Created At: %s\n", user.CreatedAt)
		fmt.Printf("Updated At: %s\n", user.UpdatedAt)
	},
}

var deleteUserCmd = &cobra.Command{
	Use:   "delete-user",
	Short: "Delete a user by email",
	Run: func(cmd *cobra.Command, args []string) {
		email, _ := cmd.Flags().GetString("email")

		if email == "" {
			log.Fatalf("Email is required")
		}

		// Find user
		var user models.User
		result := database.DB.Where("email = ?", email).First(&user)
		if result.Error != nil {
			if result.Error == gorm.ErrRecordNotFound {
				log.Fatalf("User with email %s not found", email)
			}
			log.Fatalf("Failed to find user: %v", result.Error)
		}

		// Confirm deletion
		fmt.Printf("Are you sure you want to delete user %s (%s)? [y/N]: ", user.Name, user.Email)
		var confirm string
		fmt.Scanln(&confirm)
		if confirm != "y" && confirm != "Y" {
			fmt.Println("Deletion cancelled")
			return
		}

		// Delete user
		if err := database.DB.Delete(&user).Error; err != nil {
			log.Fatalf("Failed to delete user: %v", err)
		}

		fmt.Printf("User deleted successfully: %s (%s)\n", user.Name, user.Email)
	},
}

func init() {
	// Add user command flags
	addUserCmd.Flags().StringP("name", "n", "", "User's name")
	addUserCmd.Flags().StringP("email", "e", "", "User's email")
	addUserCmd.Flags().StringP("password", "p", "", "User's password")
	addUserCmd.Flags().StringP("role", "r", "user", "User's role (default: user)")
	addUserCmd.Flags().BoolP("two-factor", "t", false, "Enable two-factor authentication")

	// Reset password command flags
	resetPasswordCmd.Flags().StringP("email", "e", "", "User's email")
	resetPasswordCmd.Flags().StringP("new-password", "p", "", "New password")

	// Get user command flags
	getUserCmd.Flags().StringP("email", "e", "", "User's email")

	// Delete user command flags
	deleteUserCmd.Flags().StringP("email", "e", "", "User's email")

	// Add commands to root command
	rootCmd.AddCommand(listUsersCmd)
	rootCmd.AddCommand(addUserCmd)
	rootCmd.AddCommand(resetPasswordCmd)
	rootCmd.AddCommand(getUserCmd)
	rootCmd.AddCommand(deleteUserCmd)
}

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Connect to database
	if err := database.Connect(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Execute the root command
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
