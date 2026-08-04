package models

import "time"

// ActiveTimer stores the one in-progress timer for a user so it is visible
// across browsers and devices before it is stopped into a time entry.
type ActiveTimer struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	UserID       uint      `json:"userId" gorm:"not null;uniqueIndex"`
	TimeEntryID  *uint     `json:"timeEntryId" gorm:"index"`
	ProjectID    uint      `json:"projectId" gorm:"not null"`
	TaskID       *uint     `json:"taskId" gorm:"index"`
	Description  string    `json:"description"`
	StartedAt    time.Time `json:"startedAt" gorm:"not null"`
	BaseDuration int       `json:"baseDuration" gorm:"comment:Previously saved duration in seconds"`
	Billable     bool      `json:"billable" gorm:"default:true"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`

	User      User       `json:"-" gorm:"foreignKey:UserID"`
	TimeEntry *TimeEntry `json:"timeEntry,omitempty" gorm:"foreignKey:TimeEntryID"`
	Project   Project    `json:"project,omitempty" gorm:"foreignKey:ProjectID"`
	Task      *Task      `json:"task,omitempty" gorm:"foreignKey:TaskID"`
}
