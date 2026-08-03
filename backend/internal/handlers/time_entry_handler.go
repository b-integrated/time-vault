package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
)

// TimeEntryRequest represents the request body for time entry operations
type TimeEntryRequest struct {
	UserID      uint      `json:"userId"`
	ProjectID   uint      `json:"projectId"`
	TaskID      uint      `json:"taskId"`
	Description string    `json:"description"`
	StartTime   time.Time `json:"startTime"`
	EndTime     time.Time `json:"endTime"`
	Duration    int       `json:"duration"`
	Billable    *bool     `json:"billable"`
}

// GetTimeEntries handles retrieving all time entries
func GetTimeEntries(w http.ResponseWriter, r *http.Request) {
	var timeEntries []models.TimeEntry
	query := database.DB.Preload("Project").Preload("Project.Client").Preload("Task").Order("start_time desc")
	if r.URL.Query().Get("billable") == "true" {
		query = query.Where("billable = ?", true)
	}
	if err := query.Find(&timeEntries).Error; err != nil {
		http.Error(w, "Failed to retrieve time entries", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(timeEntries)
}

// GetTimeEntry handles retrieving a single time entry
func GetTimeEntry(w http.ResponseWriter, r *http.Request) {
	// Get time entry ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid time entry ID", http.StatusBadRequest)
		return
	}

	// Find time entry
	var timeEntry models.TimeEntry
	if err := database.DB.Preload("Project").Preload("Project.Client").Preload("Task").First(&timeEntry, id).Error; err != nil {
		http.Error(w, "Time entry not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(timeEntry)
}

// GetUserTimeEntries handles retrieving all time entries for a user
func GetUserTimeEntries(w http.ResponseWriter, r *http.Request) {
	// Get user ID from URL
	vars := mux.Vars(r)
	userID, err := strconv.ParseUint(vars["userId"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Find time entries for user
	var timeEntries []models.TimeEntry
	if err := database.DB.Preload("Project").Preload("Project.Client").Preload("Task").Where("user_id = ?", userID).Order("start_time desc").Find(&timeEntries).Error; err != nil {
		http.Error(w, "Failed to retrieve time entries", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(timeEntries)
}

// GetProjectTimeEntries handles retrieving all time entries for a project
func GetProjectTimeEntries(w http.ResponseWriter, r *http.Request) {
	// Get project ID from URL
	vars := mux.Vars(r)
	projectID, err := strconv.ParseUint(vars["projectId"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	// Find time entries for project
	var timeEntries []models.TimeEntry
	if err := database.DB.Preload("Project").Preload("Project.Client").Preload("Task").Where("project_id = ?", projectID).Order("start_time desc").Find(&timeEntries).Error; err != nil {
		http.Error(w, "Failed to retrieve time entries", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(timeEntries)
}

// CreateTimeEntry handles creating a new time entry
func CreateTimeEntry(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req TimeEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.UserID == 0 {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}
	if req.ProjectID == 0 && req.TaskID == 0 {
		http.Error(w, "Project ID or task ID is required", http.StatusBadRequest)
		return
	}
	if req.StartTime.IsZero() {
		http.Error(w, "Start time is required", http.StatusBadRequest)
		return
	}

	// Check if user exists
	var user models.User
	if err := database.DB.First(&user, req.UserID).Error; err != nil {
		http.Error(w, "User not found", http.StatusBadRequest)
		return
	}

	project, task, err := resolveTimeEntryProjectTask(req.ProjectID, req.TaskID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Create time entry
	timeEntry := models.TimeEntry{
		UserID:      req.UserID,
		ProjectID:   project.ID,
		Description: req.Description,
		StartTime:   req.StartTime,
		EndTime:     req.EndTime,
		Billable:    true,
	}
	if task != nil {
		timeEntry.TaskID = &task.ID
		timeEntry.Billable = task.Billable
	}
	if req.Billable != nil {
		timeEntry.Billable = *req.Billable
	}

	// If end time is provided, calculate duration
	if !req.EndTime.IsZero() {
		timeEntry.EndTime = req.EndTime
		timeEntry.Duration = int(req.EndTime.Sub(req.StartTime).Seconds())
	} else if req.Duration > 0 {
		// If duration is provided, calculate end time
		timeEntry.Duration = req.Duration
		timeEntry.EndTime = req.StartTime.Add(time.Duration(req.Duration) * time.Second)
	}

	if err := database.DB.Create(&timeEntry).Error; err != nil {
		http.Error(w, "Failed to create time entry", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	database.DB.Preload("Project").Preload("Project.Client").Preload("Task").First(&timeEntry, timeEntry.ID)
	json.NewEncoder(w).Encode(timeEntry)
}

// UpdateTimeEntry handles updating a time entry
func UpdateTimeEntry(w http.ResponseWriter, r *http.Request) {
	// Get time entry ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid time entry ID", http.StatusBadRequest)
		return
	}

	// Find time entry
	var timeEntry models.TimeEntry
	if err := database.DB.First(&timeEntry, id).Error; err != nil {
		http.Error(w, "Time entry not found", http.StatusNotFound)
		return
	}

	// Parse request body
	var req TimeEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update time entry
	if req.UserID != 0 && req.UserID != timeEntry.UserID {
		// Check if user exists
		var user models.User
		if err := database.DB.First(&user, req.UserID).Error; err != nil {
			http.Error(w, "User not found", http.StatusBadRequest)
			return
		}
		timeEntry.UserID = req.UserID
	}

	if req.ProjectID != 0 || req.TaskID != 0 {
		project, task, err := resolveTimeEntryProjectTask(req.ProjectID, req.TaskID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		timeEntry.ProjectID = project.ID
		if task != nil {
			timeEntry.TaskID = &task.ID
			if req.Billable == nil {
				timeEntry.Billable = task.Billable
			}
		} else {
			timeEntry.TaskID = nil
		}
	}

	timeEntry.Description = req.Description

	// Update start time and recalculate duration if needed
	if !req.StartTime.IsZero() && req.StartTime != timeEntry.StartTime {
		timeEntry.StartTime = req.StartTime
		if !timeEntry.EndTime.IsZero() {
			timeEntry.Duration = int(timeEntry.EndTime.Sub(timeEntry.StartTime).Seconds())
		}
	}

	// Update end time and recalculate duration if needed
	if !req.EndTime.IsZero() && req.EndTime != timeEntry.EndTime {
		timeEntry.EndTime = req.EndTime
		timeEntry.Duration = int(timeEntry.EndTime.Sub(timeEntry.StartTime).Seconds())
	} else if req.Duration > 0 && req.Duration != timeEntry.Duration {
		// Update duration and recalculate end time if needed
		timeEntry.Duration = req.Duration
		timeEntry.EndTime = timeEntry.StartTime.Add(time.Duration(req.Duration) * time.Second)
	}

	// Update billable status
	if req.Billable != nil {
		timeEntry.Billable = *req.Billable
	}

	// Save changes
	if err := database.DB.Save(&timeEntry).Error; err != nil {
		http.Error(w, "Failed to update time entry", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	database.DB.Preload("Project").Preload("Project.Client").Preload("Task").First(&timeEntry, timeEntry.ID)
	json.NewEncoder(w).Encode(timeEntry)
}

func resolveTimeEntryProjectTask(projectID uint, taskID uint) (models.Project, *models.Task, error) {
	var project models.Project
	var task models.Task
	if taskID != 0 {
		if err := database.DB.Preload("Project").First(&task, taskID).Error; err != nil {
			return project, nil, errTimeEntryBadRequest("Task not found")
		}
		if projectID != 0 && projectID != task.ProjectID {
			return project, nil, errTimeEntryBadRequest("Task does not belong to selected project")
		}
		project = task.Project
		return project, &task, nil
	}
	if err := database.DB.First(&project, projectID).Error; err != nil {
		return project, nil, errTimeEntryBadRequest("Project not found")
	}
	return project, nil, nil
}

type errTimeEntryBadRequest string

func (e errTimeEntryBadRequest) Error() string {
	return string(e)
}

// DeleteTimeEntry handles deleting a time entry
func DeleteTimeEntry(w http.ResponseWriter, r *http.Request) {
	// Get time entry ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid time entry ID", http.StatusBadRequest)
		return
	}

	// Find time entry
	var timeEntry models.TimeEntry
	if err := database.DB.First(&timeEntry, id).Error; err != nil {
		http.Error(w, "Time entry not found", http.StatusNotFound)
		return
	}

	// Delete time entry (soft delete)
	if err := database.DB.Delete(&timeEntry).Error; err != nil {
		http.Error(w, "Failed to delete time entry", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
