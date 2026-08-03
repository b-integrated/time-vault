package models

import (
	"time"

	"gorm.io/gorm"
)

// Invoice represents an invoice in the system
type Invoice struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	ClientID      uint           `json:"clientId" gorm:"not null"`
	Number        string         `json:"number" gorm:"uniqueIndex;not null"`
	IssueDate     time.Time      `json:"issueDate" gorm:"not null"`
	DueDate       time.Time      `json:"dueDate" gorm:"not null"`
	Status        string         `json:"status" gorm:"default:draft"`
	Amount        float64        `json:"amount" gorm:"type:decimal(10,2);not null"`
	Tax           float64        `json:"tax" gorm:"type:decimal(10,2);default:0"`
	Total         float64        `json:"total" gorm:"type:decimal(10,2);not null"`
	DueAmount     float64        `json:"dueAmount" gorm:"type:decimal(10,2);default:0"`
	Notes         string         `json:"notes"`
	Subject       string         `json:"subject"`
	Currency      string         `json:"currency" gorm:"default:USD"`
	BillerName    string         `json:"billerName"`
	BillerAddress string         `json:"billerAddress"`
	BillerEmail   string         `json:"billerEmail"`
	BillerPhone   string         `json:"billerPhone"`
	ClientName    string         `json:"clientName"`
	ClientAddress string         `json:"clientAddress"`
	ClientEmail   string         `json:"clientEmail"`
	ClientPhone   string         `json:"clientPhone"`
	HarvestID     string         `json:"harvestId" gorm:"uniqueIndex"`
	PaidDate      *time.Time     `json:"paidDate"`
	PaidAt        *time.Time     `json:"paidAt"`
	SentAt        *time.Time     `json:"sentAt"`
	ClosedAt      *time.Time     `json:"closedAt"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Client      Client      `json:"client,omitempty" gorm:"foreignKey:ClientID"`
	TimeEntries []TimeEntry `json:"timeEntries,omitempty" gorm:"foreignKey:InvoiceID"`
}
