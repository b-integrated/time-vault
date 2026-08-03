package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/spf13/cobra"
	"github.com/timevault/backend/internal/auth"
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

var generateAPITokenCmd = &cobra.Command{
	Use:   "generate-api-token",
	Short: "Generate a TimeVault API token for automation",
	Run: func(cmd *cobra.Command, args []string) {
		email, _ := cmd.Flags().GetString("email")
		name, _ := cmd.Flags().GetString("name")
		expiresIn, _ := cmd.Flags().GetString("expires-in")

		if email == "" || name == "" {
			log.Fatalf("Email and token name are required")
		}

		var user models.User
		result := database.DB.Where("email = ?", email).First(&user)
		if result.Error != nil {
			if result.Error == gorm.ErrRecordNotFound {
				log.Fatalf("User with email %s not found", email)
			}
			log.Fatalf("Failed to find user: %v", result.Error)
		}

		rawToken, err := auth.GenerateAPIToken()
		if err != nil {
			log.Fatalf("Failed to generate API token: %v", err)
		}

		var expiresAt *time.Time
		if expiresIn != "" {
			duration, err := time.ParseDuration(expiresIn)
			if err != nil {
				log.Fatalf("Invalid --expires-in duration: %v", err)
			}
			value := time.Now().Add(duration)
			expiresAt = &value
		}

		apiToken := models.APIToken{
			UserID:      user.ID,
			Name:        name,
			TokenHash:   auth.HashAPIToken(rawToken),
			TokenPrefix: auth.APITokenDisplayPrefix(rawToken),
			ExpiresAt:   expiresAt,
		}
		if err := database.DB.Create(&apiToken).Error; err != nil {
			log.Fatalf("Failed to store API token: %v", err)
		}

		fmt.Println(rawToken)
	},
}

var listAPITokensCmd = &cobra.Command{
	Use:   "list-api-tokens",
	Short: "List API tokens without showing raw token values",
	Run: func(cmd *cobra.Command, args []string) {
		email, _ := cmd.Flags().GetString("email")

		var tokens []models.APIToken
		query := database.DB.Preload("User").Order("created_at desc")
		if email != "" {
			var user models.User
			result := database.DB.Where("email = ?", email).First(&user)
			if result.Error != nil {
				if result.Error == gorm.ErrRecordNotFound {
					log.Fatalf("User with email %s not found", email)
				}
				log.Fatalf("Failed to find user: %v", result.Error)
			}
			query = query.Where("user_id = ?", user.ID)
		}
		if err := query.Find(&tokens).Error; err != nil {
			log.Fatalf("Failed to retrieve API tokens: %v", err)
		}

		fmt.Println("API Tokens:")
		fmt.Println("ID\tUser\tName\tPrefix\tLast Used\tExpires")
		fmt.Println("--\t----\t----\t------\t---------\t-------")
		for _, token := range tokens {
			lastUsed := ""
			if token.LastUsedAt != nil {
				lastUsed = token.LastUsedAt.Format(time.RFC3339)
			}
			expires := ""
			if token.ExpiresAt != nil {
				expires = token.ExpiresAt.Format(time.RFC3339)
			}
			fmt.Printf("%d\t%s\t%s\t%s\t%s\t%s\n", token.ID, token.User.Email, token.Name, token.TokenPrefix, lastUsed, expires)
		}
	},
}

var revokeAPITokenCmd = &cobra.Command{
	Use:   "revoke-api-token",
	Short: "Revoke an API token by ID",
	Run: func(cmd *cobra.Command, args []string) {
		id, _ := cmd.Flags().GetUint("id")
		if id == 0 {
			log.Fatalf("Token id is required")
		}

		var token models.APIToken
		if err := database.DB.First(&token, id).Error; err != nil {
			log.Fatalf("API token not found: %v", err)
		}
		if err := database.DB.Delete(&token).Error; err != nil {
			log.Fatalf("Failed to revoke API token: %v", err)
		}
		fmt.Printf("API token revoked: %d\n", id)
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

	// API token command flags
	generateAPITokenCmd.Flags().StringP("email", "e", "", "User's email")
	generateAPITokenCmd.Flags().StringP("name", "n", "", "Token name")
	generateAPITokenCmd.Flags().String("expires-in", "", "Optional duration until expiration, such as 2160h for 90 days")
	listAPITokensCmd.Flags().StringP("email", "e", "", "Filter by user's email")
	revokeAPITokenCmd.Flags().Uint("id", 0, "API token ID")

	// Add commands to root command
	rootCmd.AddCommand(listUsersCmd)
	rootCmd.AddCommand(addUserCmd)
	rootCmd.AddCommand(resetPasswordCmd)
	rootCmd.AddCommand(getUserCmd)
	rootCmd.AddCommand(deleteUserCmd)
	rootCmd.AddCommand(generateAPITokenCmd)
	rootCmd.AddCommand(listAPITokensCmd)
	rootCmd.AddCommand(revokeAPITokenCmd)
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
