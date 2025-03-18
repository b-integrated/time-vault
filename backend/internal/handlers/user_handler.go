package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
)

// GetUsers handles retrieving all users
func GetUsers(w http.ResponseWriter, r *http.Request) {
	var users []models.User
	if err := database.DB.Find(&users).Error; err != nil {
		http.Error(w, "Failed to retrieve users", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// GetUser handles retrieving a single user
func GetUser(w http.ResponseWriter, r *http.Request) {
	// Get user ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Find user
	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// UpdateUser handles updating a user
func UpdateUser(w http.ResponseWriter, r *http.Request) {
	// Get user ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Find user
	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Parse request body
	var updatedUser models.User
	if err := json.NewDecoder(r.Body).Decode(&updatedUser); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update user (only allowed fields)
	if updatedUser.Name != "" {
		user.Name = updatedUser.Name
	}
	if updatedUser.Email != "" {
		user.Email = updatedUser.Email
	}
	if updatedUser.Role != "" {
		user.Role = updatedUser.Role
	}

	// Save changes
	if err := database.DB.Save(&user).Error; err != nil {
		http.Error(w, "Failed to update user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// DeleteUser handles deleting a user
func DeleteUser(w http.ResponseWriter, r *http.Request) {
	// Get user ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Find user
	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Delete user (soft delete)
	if err := database.DB.Delete(&user).Error; err != nil {
		http.Error(w, "Failed to delete user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetUserSettings handles retrieving user settings
func GetUserSettings(w http.ResponseWriter, r *http.Request) {
	// Get user ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Find user
	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Find user settings
	var settings models.UserSettings
	result := database.DB.Where("user_id = ?", id).First(&settings)

	// If settings don't exist, create default settings
	if result.Error != nil {
		settings = models.UserSettings{
			UserID:                uint(id),
			EmailNotifications:    true,
			ReminderNotifications: true,
			InvoiceNotifications:  true,
			Theme:                 "light",
		}

		// Save default settings
		if err := database.DB.Create(&settings).Error; err != nil {
			http.Error(w, "Failed to create user settings", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

// UpdateUserSettings handles updating user settings
func UpdateUserSettings(w http.ResponseWriter, r *http.Request) {
	// Get user ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Find user
	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Parse request body
	var updatedSettings models.UserSettings
	if err := json.NewDecoder(r.Body).Decode(&updatedSettings); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Find existing settings or create new ones
	var settings models.UserSettings
	result := database.DB.Where("user_id = ?", id).First(&settings)

	if result.Error != nil {
		// Create new settings
		settings = models.UserSettings{
			UserID: uint(id),
		}
	}

	// Update settings
	settings.EmailNotifications = updatedSettings.EmailNotifications
	settings.ReminderNotifications = updatedSettings.ReminderNotifications
	settings.InvoiceNotifications = updatedSettings.InvoiceNotifications

	if updatedSettings.Theme != "" {
		settings.Theme = updatedSettings.Theme
	}

	// Save changes
	if result.Error != nil {
		// Create new record
		if err := database.DB.Create(&settings).Error; err != nil {
			http.Error(w, "Failed to create user settings", http.StatusInternalServerError)
			return
		}
	} else {
		// Update existing record
		if err := database.DB.Save(&settings).Error; err != nil {
			http.Error(w, "Failed to update user settings", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}
