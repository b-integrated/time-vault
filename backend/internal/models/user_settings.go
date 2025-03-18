package models

import (
	"time"

	"gorm.io/gorm"
)

// UserSettings represents user preferences and settings
type UserSettings struct {
	ID                   uint           `json:"id" gorm:"primaryKey"`
	UserID               uint           `json:"userId" gorm:"uniqueIndex;not null"`
	EmailNotifications   bool           `json:"emailNotifications" gorm:"default:true"`
	ReminderNotifications bool          `json:"reminderNotifications" gorm:"default:true"`
	InvoiceNotifications bool           `json:"invoiceNotifications" gorm:"default:true"`
	Theme                string         `json:"theme" gorm:"default:light"`
	CreatedAt            time.Time      `json:"createdAt"`
	UpdatedAt            time.Time      `json:"updatedAt"`
	DeletedAt            gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	User                 User           `json:"-" gorm:"foreignKey:UserID"`
}