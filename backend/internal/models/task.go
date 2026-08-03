package models

import (
	"time"

	"gorm.io/gorm"
)

// Task represents a billable or non-billable work type within a project.
type Task struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	ProjectID   uint           `json:"projectId" gorm:"not null;index"`
	Name        string         `json:"name" gorm:"not null"`
	Description string         `json:"description"`
	Billable    bool           `json:"billable" gorm:"default:true"`
	Rate        float64        `json:"rate" gorm:"type:decimal(10,2)"`
	Status      string         `json:"status" gorm:"default:active"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	Project     Project     `json:"project,omitempty" gorm:"foreignKey:ProjectID"`
	TimeEntries []TimeEntry `json:"-" gorm:"foreignKey:TaskID"`
}
