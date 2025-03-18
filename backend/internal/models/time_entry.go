package models

import (
	"time"

	"gorm.io/gorm"
)

// TimeEntry represents a time tracking entry in the system
type TimeEntry struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	UserID      uint           `json:"userId" gorm:"not null"`
	ProjectID   uint           `json:"projectId" gorm:"not null"`
	Description string         `json:"description"`
	StartTime   time.Time      `json:"startTime" gorm:"not null"`
	EndTime     time.Time      `json:"endTime"`
	Duration    int            `json:"duration" gorm:"comment:Duration in seconds"`
	Billable    bool           `json:"billable" gorm:"default:true"`
	InvoiceID   *uint          `json:"invoiceId"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	User    User    `json:"-" gorm:"foreignKey:UserID"`
	Project Project `json:"-" gorm:"foreignKey:ProjectID"`
	Invoice *Invoice `json:"-" gorm:"foreignKey:InvoiceID"`
}