package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
)

// ProjectRequest represents the request body for project operations
type ProjectRequest struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	ClientID    uint    `json:"clientId"`
	Rate        float64 `json:"rate"`
	Status      string  `json:"status"`
}

// GetProjects handles retrieving all projects
func GetProjects(w http.ResponseWriter, r *http.Request) {
	var projects []models.Project
	if err := database.DB.Find(&projects).Error; err != nil {
		http.Error(w, "Failed to retrieve projects", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}

// GetProject handles retrieving a single project
func GetProject(w http.ResponseWriter, r *http.Request) {
	// Get project ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	// Find project
	var project models.Project
	if err := database.DB.First(&project, id).Error; err != nil {
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(project)
}

// GetClientProjects handles retrieving all projects for a client
func GetClientProjects(w http.ResponseWriter, r *http.Request) {
	// Get client ID from URL
	vars := mux.Vars(r)
	clientID, err := strconv.ParseUint(vars["clientId"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid client ID", http.StatusBadRequest)
		return
	}

	// Find projects for client
	var projects []models.Project
	if err := database.DB.Where("client_id = ?", clientID).Find(&projects).Error; err != nil {
		http.Error(w, "Failed to retrieve projects", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}

// CreateProject handles creating a new project
func CreateProject(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req ProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}
	if req.ClientID == 0 {
		http.Error(w, "Client ID is required", http.StatusBadRequest)
		return
	}

	// Check if client exists
	var client models.Client
	if err := database.DB.First(&client, req.ClientID).Error; err != nil {
		http.Error(w, "Client not found", http.StatusBadRequest)
		return
	}

	// Create project
	project := models.Project{
		Name:        req.Name,
		Description: req.Description,
		ClientID:    req.ClientID,
		Rate:        req.Rate,
		Status:      req.Status,
	}

	if project.Status == "" {
		project.Status = "active"
	}

	if err := database.DB.Create(&project).Error; err != nil {
		http.Error(w, "Failed to create project", http.StatusInternalServerError)
		return
	}
	defaultTask := models.Task{
		ProjectID:   project.ID,
		Name:        "General",
		Description: "Default task",
		Billable:    true,
		Rate:        project.Rate,
		Status:      "active",
	}
	if err := database.DB.Create(&defaultTask).Error; err != nil {
		http.Error(w, "Failed to create default project task", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(project)
}

// UpdateProject handles updating a project
func UpdateProject(w http.ResponseWriter, r *http.Request) {
	// Get project ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	// Find project
	var project models.Project
	if err := database.DB.First(&project, id).Error; err != nil {
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}

	// Parse request body
	var req ProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update project
	if req.Name != "" {
		project.Name = req.Name
	}
	if req.Description != "" {
		project.Description = req.Description
	}
	if req.ClientID != 0 && req.ClientID != project.ClientID {
		// Check if client exists
		var client models.Client
		if err := database.DB.First(&client, req.ClientID).Error; err != nil {
			http.Error(w, "Client not found", http.StatusBadRequest)
			return
		}
		project.ClientID = req.ClientID
	}
	if req.Rate != 0 {
		project.Rate = req.Rate
	}
	if req.Status != "" {
		project.Status = req.Status
	}

	// Save changes
	if err := database.DB.Save(&project).Error; err != nil {
		http.Error(w, "Failed to update project", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(project)
}

// DeleteProject handles deleting a project
func DeleteProject(w http.ResponseWriter, r *http.Request) {
	// Get project ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	// Find project
	var project models.Project
	if err := database.DB.First(&project, id).Error; err != nil {
		http.Error(w, "Project not found", http.StatusNotFound)
		return
	}

	// Delete project (soft delete)
	if err := database.DB.Delete(&project).Error; err != nil {
		http.Error(w, "Failed to delete project", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
