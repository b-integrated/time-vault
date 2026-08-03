package models

import (
	"time"

	"gorm.io/gorm"
)

// Invoice represents an invoice in the system
type Invoice struct {
	ID            uint           `json:"id" gorm:"primaryKey"`
	ClientID      uint           `json:"clientId" gorm:"not null"`
	Number        string         `json:"number" gorm:"not null"`
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
	HarvestID     string         `json:"harvestId"`
	PaidDate      *time.Time     `json:"paidDate"`
	PaidAt        *time.Time     `json:"paidAt"`
	SentAt        *time.Time     `json:"sentAt"`
	ClosedAt      *time.Time     `json:"closedAt"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Client      Client        `json:"client,omitempty" gorm:"foreignKey:ClientID"`
	TimeEntries []TimeEntry   `json:"timeEntries,omitempty" gorm:"foreignKey:InvoiceID"`
	Lines       []InvoiceLine `json:"lines,omitempty" gorm:"foreignKey:InvoiceID"`
}

// InvoiceLine is the invoice's billing snapshot for one line item.
//
// OriginalTimeEntryID links back to the real time record when the line came
// from tracked time. Description, Hours, Rate, and Amount are intentionally
// editable here without mutating the original TimeEntry.
type InvoiceLine struct {
	ID                  uint           `json:"id" gorm:"primaryKey"`
	InvoiceID           uint           `json:"invoiceId" gorm:"not null;index"`
	OriginalTimeEntryID *uint          `json:"originalTimeEntryId" gorm:"index"`
	ProjectID           *uint          `json:"projectId" gorm:"index"`
	ServiceDate         *time.Time     `json:"serviceDate"`
	ProjectName         string         `json:"projectName"`
	Description         string         `json:"description"`
	Hours               float64        `json:"hours" gorm:"type:decimal(10,2);not null;default:0"`
	Rate                float64        `json:"rate" gorm:"type:decimal(10,2);not null;default:0"`
	Amount              float64        `json:"amount" gorm:"type:decimal(10,2);not null;default:0"`
	LineType            string         `json:"lineType" gorm:"default:time"`
	SortOrder           int            `json:"sortOrder" gorm:"default:0"`
	CreatedAt           time.Time      `json:"createdAt"`
	UpdatedAt           time.Time      `json:"updatedAt"`
	DeletedAt           gorm.DeletedAt `json:"-" gorm:"index"`

	Invoice           Invoice    `json:"-" gorm:"foreignKey:InvoiceID"`
	OriginalTimeEntry *TimeEntry `json:"originalTimeEntry,omitempty" gorm:"foreignKey:OriginalTimeEntryID"`
	Project           *Project   `json:"project,omitempty" gorm:"foreignKey:ProjectID"`
}
