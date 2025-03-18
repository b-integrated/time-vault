package auth

import (
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"net/smtp"
	"os"
	"strconv"
	"time"
)

// TwoFactorCode represents a 2FA code
type TwoFactorCode struct {
	Code      string
	ExpiresAt time.Time
}

// GenerateTwoFactorCode generates a 6-digit 2FA code
func GenerateTwoFactorCode() (*TwoFactorCode, error) {
	// Generate random bytes
	randomBytes := make([]byte, 5)
	_, err := rand.Read(randomBytes)
	if err != nil {
		return nil, err
	}

	// Convert to base32 and take first 6 digits
	encoded := base32.StdEncoding.EncodeToString(randomBytes)
	code := ""
	for i := 0; i < 6; i++ {
		index, err := strconv.ParseInt(string(encoded[i%len(encoded)]), 32, 64)
		if err != nil {
			index = int64(i)
		}
		code += strconv.FormatInt(index%10, 10)
	}

	// Set expiration time (10 minutes)
	expiresAt := time.Now().Add(10 * time.Minute)

	return &TwoFactorCode{
		Code:      code,
		ExpiresAt: expiresAt,
	}, nil
}

// SendTwoFactorCodeByEmail sends a 2FA code to the user's email
func SendTwoFactorCodeByEmail(email, code string) error {
	// Get email configuration from environment
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPassword := os.Getenv("SMTP_PASSWORD")
	smtpFrom := os.Getenv("SMTP_FROM")

	if smtpHost == "" || smtpPort == "" || smtpUser == "" || smtpPassword == "" || smtpFrom == "" {
		return fmt.Errorf("SMTP configuration not set")
	}

	// Set up authentication
	auth := smtp.PlainAuth("", smtpUser, smtpPassword, smtpHost)

	// Compose email
	to := []string{email}
	subject := "TimeVault - Your 2FA Code"
	body := fmt.Sprintf("Your TimeVault verification code is: %s\n\nThis code will expire in 10 minutes.", code)
	message := []byte(fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s", email, subject, body))

	// Send email
	err := smtp.SendMail(smtpHost+":"+smtpPort, auth, smtpFrom, to, message)
	if err != nil {
		return err
	}

	return nil
}

// ValidateTwoFactorCode validates a 2FA code
func ValidateTwoFactorCode(storedCode *TwoFactorCode, providedCode string) bool {
	// Check if code has expired
	if time.Now().After(storedCode.ExpiresAt) {
		return false
	}

	// Check if code matches
	return storedCode.Code == providedCode
}