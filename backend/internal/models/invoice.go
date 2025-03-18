package models

import (
	"time"

	"gorm.io/gorm"
)

// Invoice represents an invoice in the system
type Invoice struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	ClientID  uint           `json:"clientId" gorm:"not null"`
	Number    string         `json:"number" gorm:"uniqueIndex;not null"`
	IssueDate time.Time      `json:"issueDate" gorm:"not null"`
	DueDate   time.Time      `json:"dueDate" gorm:"not null"`
	Status    string         `json:"status" gorm:"default:draft"`
	Amount    float64        `json:"amount" gorm:"type:decimal(10,2);not null"`
	Tax       float64        `json:"tax" gorm:"type:decimal(10,2);default:0"`
	Total     float64        `json:"total" gorm:"type:decimal(10,2);not null"`
	Notes     string         `json:"notes"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Client      Client       `json:"-" gorm:"foreignKey:ClientID"`
	TimeEntries []TimeEntry  `json:"-" gorm:"foreignKey:InvoiceID"`
}