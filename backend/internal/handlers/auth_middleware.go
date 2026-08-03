package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/timevault/backend/internal/auth"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
)

type contextKey string

const currentUserContextKey contextKey = "currentUser"

// AuthMiddleware accepts normal Time Vault JWTs and long-lived API tokens.
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := bearerToken(r)
		if token == "" {
			http.Error(w, "Authorization token required", http.StatusUnauthorized)
			return
		}

		if claims, err := auth.ValidateToken(token); err == nil {
			ctx := context.WithValue(r.Context(), currentUserContextKey, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		apiToken, ok := lookupAPIToken(token)
		if !ok {
			http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		now := time.Now()
		database.DB.Model(&apiToken).Update("last_used_at", &now)
		ctx := context.WithValue(r.Context(), currentUserContextKey, apiToken.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func bearerToken(r *http.Request) string {
	header := r.Header.Get("Authorization")
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func lookupAPIToken(rawToken string) (models.APIToken, bool) {
	var token models.APIToken
	hash := auth.HashAPIToken(rawToken)
	if err := database.DB.Where("token_hash = ?", hash).First(&token).Error; err != nil {
		return token, false
	}
	if token.ExpiresAt != nil && time.Now().After(*token.ExpiresAt) {
		return token, false
	}
	return token, true
}
