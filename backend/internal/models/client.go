package models

import (
	"time"

	"gorm.io/gorm"
)

// Client represents a client in the system
type Client struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	Name      string         `json:"name" gorm:"not null"`
	Email     string         `json:"email"`
	Phone     string         `json:"phone"`
	Address   string         `json:"address"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Projects []Project `json:"-" gorm:"foreignKey:ClientID"`
	Invoices []Invoice `json:"-" gorm:"foreignKey:ClientID"`
}