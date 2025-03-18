package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system
type User struct {
	ID               uint           `json:"id" gorm:"primaryKey"`
	Email            string         `json:"email" gorm:"uniqueIndex;not null"`
	Password         string         `json:"-" gorm:"not null"` // Password is not exposed in JSON
	Name             string         `json:"name" gorm:"not null"`
	Role             string         `json:"role" gorm:"default:user"`
	TwoFactorEnabled bool           `json:"twoFactorEnabled" gorm:"default:false"`
	TwoFactorSecret  string         `json:"-"` // 2FA secret is not exposed in JSON
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	TimeEntries []TimeEntry `json:"-" gorm:"foreignKey:UserID"`
}