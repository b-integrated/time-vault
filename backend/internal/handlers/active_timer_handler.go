package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
	"gorm.io/gorm"
)

type ActiveTimerRequest struct {
	TimeEntryID  *uint     `json:"timeEntryId"`
	ProjectID    uint      `json:"projectId"`
	TaskID       uint      `json:"taskId"`
	Description  string    `json:"description"`
	StartedAt    time.Time `json:"startedAt"`
	BaseDuration int       `json:"baseDuration"`
	Billable     *bool     `json:"billable"`
}

type ActiveTimerResponse struct {
	models.ActiveTimer
	ElapsedDuration int `json:"elapsedDuration"`
	TotalDuration   int `json:"totalDuration"`
}

func GetUserActiveTimer(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseActiveTimerUserID(w, r)
	if !ok {
		return
	}

	var timer models.ActiveTimer
	err := activeTimerQuery().Where("user_id = ?", userID).First(&timer).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err != nil {
		http.Error(w, "Failed to retrieve active timer", http.StatusInternalServerError)
		return
	}

	writeActiveTimer(w, timer)
}

func UpsertUserActiveTimer(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseActiveTimerUserID(w, r)
	if !ok {
		return
	}

	var req ActiveTimerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.ProjectID == 0 && req.TaskID == 0 {
		http.Error(w, "Project ID or task ID is required", http.StatusBadRequest)
		return
	}
	if req.StartedAt.IsZero() {
		req.StartedAt = time.Now()
	}
	if req.BaseDuration < 0 {
		req.BaseDuration = 0
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		http.Error(w, "User not found", http.StatusBadRequest)
		return
	}

	project, task, err := resolveTimeEntryProjectTask(req.ProjectID, req.TaskID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.TimeEntryID != nil {
		var entry models.TimeEntry
		if err := database.DB.First(&entry, *req.TimeEntryID).Error; err != nil {
			http.Error(w, "Time entry not found", http.StatusBadRequest)
			return
		}
		if entry.UserID != userID {
			http.Error(w, "Time entry does not belong to selected user", http.StatusBadRequest)
			return
		}
		if entry.ProjectID != project.ID {
			http.Error(w, "Time entry does not belong to selected project", http.StatusBadRequest)
			return
		}
		if req.BaseDuration == 0 {
			req.BaseDuration = entry.Duration
		}
	}

	billable := true
	if task != nil {
		billable = task.Billable
	}
	if req.Billable != nil {
		billable = *req.Billable
	}

	timer := models.ActiveTimer{
		UserID:       userID,
		TimeEntryID:  req.TimeEntryID,
		ProjectID:    project.ID,
		Description:  req.Description,
		StartedAt:    req.StartedAt,
		BaseDuration: req.BaseDuration,
		Billable:     billable,
	}
	if task != nil {
		timer.TaskID = &task.ID
	}

	var existing models.ActiveTimer
	err = database.DB.Where("user_id = ?", userID).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if err := database.DB.Create(&timer).Error; err != nil {
			http.Error(w, "Failed to start active timer", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
	} else if err != nil {
		http.Error(w, "Failed to start active timer", http.StatusInternalServerError)
		return
	} else {
		timer.ID = existing.ID
		timer.CreatedAt = existing.CreatedAt
		if err := database.DB.Save(&timer).Error; err != nil {
			http.Error(w, "Failed to update active timer", http.StatusInternalServerError)
			return
		}
	}

	activeTimerQuery().First(&timer, timer.ID)
	writeActiveTimer(w, timer)
}

func DeleteUserActiveTimer(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseActiveTimerUserID(w, r)
	if !ok {
		return
	}

	if err := database.DB.Where("user_id = ?", userID).Delete(&models.ActiveTimer{}).Error; err != nil {
		http.Error(w, "Failed to clear active timer", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseActiveTimerUserID(w http.ResponseWriter, r *http.Request) (uint, bool) {
	vars := mux.Vars(r)
	userID, err := strconv.ParseUint(vars["userId"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return 0, false
	}
	return uint(userID), true
}

func activeTimerQuery() *gorm.DB {
	return database.DB.Preload("TimeEntry").Preload("TimeEntry.Project").Preload("TimeEntry.Project.Client").Preload("TimeEntry.Task").Preload("Project").Preload("Project.Client").Preload("Task")
}

func writeActiveTimer(w http.ResponseWriter, timer models.ActiveTimer) {
	elapsed := int(time.Since(timer.StartedAt).Seconds())
	if elapsed < 0 {
		elapsed = 0
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ActiveTimerResponse{
		ActiveTimer:     timer,
		ElapsedDuration: elapsed,
		TotalDuration:   timer.BaseDuration + elapsed,
	})
}

// StopUserActiveTimer converts the user's in-progress ActiveTimer into a saved
// TimeEntry (elapsed = baseDuration + time since startedAt) and clears the timer,
// atomically in one transaction. This is the single source of truth for stopping
// a timer, shared by the UI and the CLI, so the elapsed-time math can never drift
// between clients. Returns 204 if no timer is running, 201 with the new entry
// otherwise.
func StopUserActiveTimer(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseActiveTimerUserID(w, r)
	if !ok {
		return
	}

	var timer models.ActiveTimer
	err := database.DB.Where("user_id = ?", userID).First(&timer).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err != nil {
		http.Error(w, "Failed to retrieve active timer", http.StatusInternalServerError)
		return
	}

	now := time.Now()
	elapsed := int(now.Sub(timer.StartedAt).Seconds())
	if elapsed < 0 {
		elapsed = 0
	}

	entry := models.TimeEntry{
		UserID:      userID,
		ProjectID:   timer.ProjectID,
		TaskID:      timer.TaskID,
		Description: timer.Description,
		StartTime:   timer.StartedAt,
		EndTime:     now,
		Duration:    timer.BaseDuration + elapsed,
		Billable:    timer.Billable,
	}

	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&entry).Error; err != nil {
			return err
		}
		return tx.Where("user_id = ?", userID).Delete(&models.ActiveTimer{}).Error
	}); err != nil {
		http.Error(w, "Failed to stop active timer", http.StatusInternalServerError)
		return
	}

	database.DB.Preload("Project").Preload("Task").First(&entry, entry.ID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(entry)
}
