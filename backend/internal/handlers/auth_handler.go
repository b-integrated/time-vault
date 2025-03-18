package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/timevault/backend/internal/auth"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

// RegisterRequest represents the request body for user registration
type RegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginRequest represents the request body for user login
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// VerifyTwoFactorRequest represents the request body for 2FA verification
type VerifyTwoFactorRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

// AuthResponse represents the response for authentication endpoints
type AuthResponse struct {
	Token string      `json:"token,omitempty"`
	User  models.User `json:"user"`
}

// CheckUsersResponse represents the response for the check-users endpoint
type CheckUsersResponse struct {
	UsersExist bool `json:"usersExist"`
}

// SetupRequest represents the request body for first-time setup
type SetupRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	IsAdmin  bool   `json:"isAdmin"`
}

// Register handles user registration
func Register(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Name == "" || req.Email == "" || req.Password == "" {
		http.Error(w, "Name, email, and password are required", http.StatusBadRequest)
		return
	}

	// Check if user already exists
	var existingUser models.User
	result := database.DB.Where("email = ?", req.Email).First(&existingUser)
	if result.RowsAffected > 0 {
		http.Error(w, "User with this email already exists", http.StatusConflict)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	// Create user
	user := models.User{
		Name:             req.Name,
		Email:            req.Email,
		Password:         string(hashedPassword),
		Role:             "user",
		TwoFactorEnabled: true, // Enable 2FA by default
	}

	if err := database.DB.Create(&user).Error; err != nil {
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	// Generate 2FA code
	twoFactorCode, err := auth.GenerateTwoFactorCode()
	if err != nil {
		http.Error(w, "Failed to generate 2FA code", http.StatusInternalServerError)
		return
	}

	// Store 2FA code in session or cache (in a real app)
	// For simplicity, we'll just send it to the user's email

	// Send 2FA code by email
	err = auth.SendTwoFactorCodeByEmail(user.Email, twoFactorCode.Code)
	if err != nil {
		// Check if we're in development mode
		if os.Getenv("ENV") == "development" {
			// In development mode, include the code in the response for testing
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"User":    user,
				"Code":    twoFactorCode.Code, // Include code in response for development
				"Message": "SMTP not configured. In development mode, using mock 2FA code.",
			})
			return
		} else {
			// In production, return an error
			http.Error(w, "Failed to send 2FA code: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	// Return user data (without token yet, as 2FA is required)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(AuthResponse{
		User: user,
	})
}

// Login handles user login
func Login(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Email == "" || req.Password == "" {
		http.Error(w, "Email and password are required", http.StatusBadRequest)
		return
	}

	// Find user
	var user models.User
	result := database.DB.Where("email = ?", req.Email).First(&user)
	if result.RowsAffected == 0 {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	// Generate 2FA code
	twoFactorCode, err := auth.GenerateTwoFactorCode()
	if err != nil {
		http.Error(w, "Failed to generate 2FA code", http.StatusInternalServerError)
		return
	}

	// Store 2FA code in session or cache (in a real app)
	// For simplicity, we'll just send it to the user's email

	// Send 2FA code by email
	err = auth.SendTwoFactorCodeByEmail(user.Email, twoFactorCode.Code)
	if err != nil {
		// Check if we're in development mode
		if os.Getenv("ENV") == "development" {
			// In development mode, include the code in the response for testing
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"User":    user,
				"Code":    twoFactorCode.Code, // Include code in response for development
				"Message": "SMTP not configured. In development mode, using mock 2FA code.",
			})
			return
		} else {
			// In production, return an error
			http.Error(w, "Failed to send 2FA code: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	// Return user data (without token yet, as 2FA is required)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{
		User: user,
	})
}

// CheckUsers handles checking if any users exist in the system
func CheckUsers(w http.ResponseWriter, r *http.Request) {
	// Count users in the database
	var count int64
	database.DB.Model(&models.User{}).Count(&count)

	// Return response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(CheckUsersResponse{
		UsersExist: count > 0,
	})
}

// Setup handles the first-time setup and admin user creation
func Setup(w http.ResponseWriter, r *http.Request) {
	// Check if any users exist
	var count int64
	database.DB.Model(&models.User{}).Count(&count)

	// If users already exist, return error
	if count > 0 {
		http.Error(w, "Setup already completed. Users already exist in the system", http.StatusConflict)
		return
	}

	// Parse request body
	var req SetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Name == "" || req.Email == "" || req.Password == "" {
		http.Error(w, "Name, email, and password are required", http.StatusBadRequest)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	// Create admin user
	user := models.User{
		Name:             req.Name,
		Email:            req.Email,
		Password:         string(hashedPassword),
		Role:             "admin", // Set role to admin
		TwoFactorEnabled: false,   // Disable 2FA for admin during setup
	}

	if err := database.DB.Create(&user).Error; err != nil {
		http.Error(w, "Failed to create admin user", http.StatusInternalServerError)
		return
	}

	// Generate JWT token
	token, err := auth.GenerateToken(&user)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Return token and user data
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(AuthResponse{
		Token: token,
		User:  user,
	})
}

// VerifyTwoFactor handles 2FA verification
func VerifyTwoFactor(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req VerifyTwoFactorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Email == "" || req.Code == "" {
		http.Error(w, "Email and code are required", http.StatusBadRequest)
		return
	}

	// Find user
	var user models.User
	result := database.DB.Where("email = ?", req.Email).First(&user)
	if result.RowsAffected == 0 {
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	// In a real app, we would retrieve the stored 2FA code from session or cache
	// For simplicity, we'll just validate the code format
	storedCode := &auth.TwoFactorCode{
		Code:      req.Code, // In a real app, this would be retrieved from storage
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}

	// Validate 2FA code
	if !auth.ValidateTwoFactorCode(storedCode, req.Code) {
		http.Error(w, "Invalid or expired code", http.StatusUnauthorized)
		return
	}

	// Generate JWT token
	token, err := auth.GenerateToken(&user)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	// Return token and user data
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuthResponse{
		Token: token,
		User:  user,
	})
}
