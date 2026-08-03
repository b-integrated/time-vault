package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
)

type TaskRequest struct {
	ProjectID   uint    `json:"projectId"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Billable    *bool   `json:"billable"`
	Rate        float64 `json:"rate"`
	Status      string  `json:"status"`
}

func GetTasks(w http.ResponseWriter, r *http.Request) {
	var tasks []models.Task
	query := database.DB.Preload("Project").Preload("Project.Client").Order("name asc")
	if projectID := r.URL.Query().Get("projectId"); projectID != "" {
		parsedID, err := strconv.ParseUint(projectID, 10, 32)
		if err != nil {
			http.Error(w, "Invalid projectId", http.StatusBadRequest)
			return
		}
		query = query.Where("project_id = ?", uint(parsedID))
	}
	if err := query.Find(&tasks).Error; err != nil {
		http.Error(w, "Failed to retrieve tasks", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

func GetProjectTasks(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID, err := strconv.ParseUint(vars["projectId"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	var tasks []models.Task
	if err := database.DB.Where("project_id = ?", uint(projectID)).Order("name asc").Find(&tasks).Error; err != nil {
		http.Error(w, "Failed to retrieve tasks", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

func CreateTask(w http.ResponseWriter, r *http.Request) {
	var req TaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.ProjectID == 0 || req.Name == "" {
		http.Error(w, "projectId and name are required", http.StatusBadRequest)
		return
	}

	var project models.Project
	if err := database.DB.First(&project, req.ProjectID).Error; err != nil {
		http.Error(w, "Project not found", http.StatusBadRequest)
		return
	}

	billable := true
	if req.Billable != nil {
		billable = *req.Billable
	}
	task := models.Task{
		ProjectID:   req.ProjectID,
		Name:        req.Name,
		Description: req.Description,
		Billable:    billable,
		Rate:        req.Rate,
		Status:      defaultInvoiceString(req.Status, "active"),
	}
	if task.Rate == 0 {
		task.Rate = project.Rate
	}

	if err := database.DB.Create(&task).Error; err != nil {
		http.Error(w, "Failed to create task", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(task)
}

func UpdateTask(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid task ID", http.StatusBadRequest)
		return
	}

	var task models.Task
	if err := database.DB.First(&task, id).Error; err != nil {
		http.Error(w, "Task not found", http.StatusNotFound)
		return
	}

	var req TaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.ProjectID != 0 && req.ProjectID != task.ProjectID {
		var project models.Project
		if err := database.DB.First(&project, req.ProjectID).Error; err != nil {
			http.Error(w, "Project not found", http.StatusBadRequest)
			return
		}
		task.ProjectID = req.ProjectID
	}
	if req.Name != "" {
		task.Name = req.Name
	}
	task.Description = req.Description
	if req.Billable != nil {
		task.Billable = *req.Billable
	}
	if req.Rate != 0 {
		task.Rate = req.Rate
	}
	if req.Status != "" {
		task.Status = req.Status
	}

	if err := database.DB.Save(&task).Error; err != nil {
		http.Error(w, "Failed to update task", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

func DeleteTask(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid task ID", http.StatusBadRequest)
		return
	}

	var task models.Task
	if err := database.DB.First(&task, id).Error; err != nil {
		http.Error(w, "Task not found", http.StatusNotFound)
		return
	}
	if err := database.DB.Delete(&task).Error; err != nil {
		http.Error(w, "Failed to delete task", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
