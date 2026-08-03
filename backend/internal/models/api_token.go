package models

import (
	"time"

	"gorm.io/gorm"
)

// APIToken stores a hashed personal access token for automation clients.
type APIToken struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	UserID      uint           `json:"userId" gorm:"not null;index"`
	Name        string         `json:"name" gorm:"not null"`
	TokenHash   string         `json:"-" gorm:"uniqueIndex;not null"`
	TokenPrefix string         `json:"tokenPrefix" gorm:"index"`
	LastUsedAt  *time.Time     `json:"lastUsedAt"`
	ExpiresAt   *time.Time     `json:"expiresAt"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}
