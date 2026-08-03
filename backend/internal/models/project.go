package models

import (
	"time"

	"gorm.io/gorm"
)

// Project represents a project in the system
type Project struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	Name        string         `json:"name" gorm:"not null"`
	Description string         `json:"description"`
	ClientID    uint           `json:"clientId" gorm:"not null"`
	Rate        float64        `json:"rate" gorm:"type:decimal(10,2)"`
	Status      string         `json:"status" gorm:"default:active"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Client      Client      `json:"client,omitempty" gorm:"foreignKey:ClientID"`
	TimeEntries []TimeEntry `json:"-" gorm:"foreignKey:ProjectID"`
}
