package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
)

// ClientRequest represents the request body for client operations
type ClientRequest struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Phone   string `json:"phone"`
	Address string `json:"address"`
}

// GetClients handles retrieving all clients
func GetClients(w http.ResponseWriter, r *http.Request) {
	var clients []models.Client
	if err := database.DB.Find(&clients).Error; err != nil {
		http.Error(w, "Failed to retrieve clients", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(clients)
}

// GetClient handles retrieving a single client
func GetClient(w http.ResponseWriter, r *http.Request) {
	// Get client ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid client ID", http.StatusBadRequest)
		return
	}

	// Find client
	var client models.Client
	if err := database.DB.First(&client, id).Error; err != nil {
		http.Error(w, "Client not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(client)
}

// CreateClient handles creating a new client
func CreateClient(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req ClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	// Create client
	client := models.Client{
		Name:    req.Name,
		Email:   req.Email,
		Phone:   req.Phone,
		Address: req.Address,
	}

	if err := database.DB.Create(&client).Error; err != nil {
		http.Error(w, "Failed to create client", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(client)
}

// UpdateClient handles updating a client
func UpdateClient(w http.ResponseWriter, r *http.Request) {
	// Get client ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid client ID", http.StatusBadRequest)
		return
	}

	// Find client
	var client models.Client
	if err := database.DB.First(&client, id).Error; err != nil {
		http.Error(w, "Client not found", http.StatusNotFound)
		return
	}

	// Parse request body
	var req ClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update client
	if req.Name != "" {
		client.Name = req.Name
	}
	if req.Email != "" {
		client.Email = req.Email
	}
	if req.Phone != "" {
		client.Phone = req.Phone
	}
	if req.Address != "" {
		client.Address = req.Address
	}

	// Save changes
	if err := database.DB.Save(&client).Error; err != nil {
		http.Error(w, "Failed to update client", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(client)
}

// DeleteClient handles deleting a client
func DeleteClient(w http.ResponseWriter, r *http.Request) {
	// Get client ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid client ID", http.StatusBadRequest)
		return
	}

	// Find client
	var client models.Client
	if err := database.DB.First(&client, id).Error; err != nil {
		http.Error(w, "Client not found", http.StatusNotFound)
		return
	}

	// Delete client (soft delete)
	if err := database.DB.Delete(&client).Error; err != nil {
		http.Error(w, "Failed to delete client", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}