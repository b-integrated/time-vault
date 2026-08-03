package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/handlers"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Connect to database
	if err := database.Connect(); err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Run database migrations
	if err := database.Migrate(); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Create a new router
	router := mux.NewRouter()

	// Set up CORS middleware
	corsMiddleware := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:8000", "http://localhost:8080"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})

	// Set up API routes
	apiRouter := router.PathPrefix("/api").Subrouter()

	// Auth routes
	apiRouter.HandleFunc("/auth/register", handlers.Register).Methods("POST")
	apiRouter.HandleFunc("/auth/login", handlers.Login).Methods("POST")
	apiRouter.HandleFunc("/auth/verify", handlers.VerifyTwoFactor).Methods("POST")
	apiRouter.HandleFunc("/auth/check-users", handlers.CheckUsers).Methods("GET")
	apiRouter.HandleFunc("/auth/setup", handlers.Setup).Methods("POST")

	protectedRouter := apiRouter.NewRoute().Subrouter()
	protectedRouter.Use(handlers.AuthMiddleware)

	// User routes
	protectedRouter.HandleFunc("/users", handlers.GetUsers).Methods("GET")
	protectedRouter.HandleFunc("/users/{id}", handlers.GetUser).Methods("GET")
	protectedRouter.HandleFunc("/users/{id}", handlers.UpdateUser).Methods("PUT")
	protectedRouter.HandleFunc("/users/{id}", handlers.DeleteUser).Methods("DELETE")
	protectedRouter.HandleFunc("/users/{id}/settings", handlers.GetUserSettings).Methods("GET")
	protectedRouter.HandleFunc("/users/{id}/settings", handlers.UpdateUserSettings).Methods("PUT")

	// Client routes
	protectedRouter.HandleFunc("/clients", handlers.GetClients).Methods("GET")
	protectedRouter.HandleFunc("/clients", handlers.CreateClient).Methods("POST")
	protectedRouter.HandleFunc("/clients/{id}", handlers.GetClient).Methods("GET")
	protectedRouter.HandleFunc("/clients/{id}", handlers.UpdateClient).Methods("PUT")
	protectedRouter.HandleFunc("/clients/{id}", handlers.DeleteClient).Methods("DELETE")

	// Project routes
	protectedRouter.HandleFunc("/projects", handlers.GetProjects).Methods("GET")
	protectedRouter.HandleFunc("/projects", handlers.CreateProject).Methods("POST")
	protectedRouter.HandleFunc("/projects/{id}", handlers.GetProject).Methods("GET")
	protectedRouter.HandleFunc("/projects/{id}", handlers.UpdateProject).Methods("PUT")
	protectedRouter.HandleFunc("/projects/{id}", handlers.DeleteProject).Methods("DELETE")
	protectedRouter.HandleFunc("/clients/{clientId}/projects", handlers.GetClientProjects).Methods("GET")

	// Time entry routes
	protectedRouter.HandleFunc("/time-entries", handlers.GetTimeEntries).Methods("GET")
	protectedRouter.HandleFunc("/time-entries", handlers.CreateTimeEntry).Methods("POST")
	protectedRouter.HandleFunc("/time-entries/{id}", handlers.GetTimeEntry).Methods("GET")
	protectedRouter.HandleFunc("/time-entries/{id}", handlers.UpdateTimeEntry).Methods("PUT")
	protectedRouter.HandleFunc("/time-entries/{id}", handlers.DeleteTimeEntry).Methods("DELETE")
	protectedRouter.HandleFunc("/users/{userId}/time-entries", handlers.GetUserTimeEntries).Methods("GET")
	protectedRouter.HandleFunc("/projects/{projectId}/time-entries", handlers.GetProjectTimeEntries).Methods("GET")
	protectedRouter.HandleFunc("/import/harvest-time/preview", handlers.PreviewHarvestTime).Methods("POST")
	protectedRouter.HandleFunc("/import/harvest-time", handlers.ImportHarvestTime).Methods("POST")
	protectedRouter.HandleFunc("/import/harvest-invoices/preview", handlers.PreviewHarvestInvoices).Methods("POST")
	protectedRouter.HandleFunc("/import/harvest-invoices", handlers.ImportHarvestInvoices).Methods("POST")

	// Invoice routes
	protectedRouter.HandleFunc("/invoices", handlers.GetInvoices).Methods("GET")
	protectedRouter.HandleFunc("/invoices", handlers.CreateInvoice).Methods("POST")
	protectedRouter.HandleFunc("/invoices/generate", handlers.GenerateInvoice).Methods("POST")
	protectedRouter.HandleFunc("/invoices/{id}", handlers.GetInvoice).Methods("GET")
	protectedRouter.HandleFunc("/invoices/{id}", handlers.UpdateInvoice).Methods("PUT")
	protectedRouter.HandleFunc("/invoices/{id}", handlers.DeleteInvoice).Methods("DELETE")
	protectedRouter.HandleFunc("/invoices/{id}/time-entries", handlers.GetInvoiceTimeEntries).Methods("GET")
	protectedRouter.HandleFunc("/invoices/{id}/pdf", handlers.DownloadInvoicePDF).Methods("GET")
	protectedRouter.HandleFunc("/invoices/{id}/qbo-csv", handlers.DownloadInvoiceQBOCSV).Methods("GET")
	protectedRouter.HandleFunc("/clients/{clientId}/invoices", handlers.GetClientInvoices).Methods("GET")

	// Report routes
	protectedRouter.HandleFunc("/reports", handlers.GetReports).Methods("GET")
	protectedRouter.HandleFunc("/reports/pdf", handlers.DownloadReportPDF).Methods("GET")

	// Health check route
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}).Methods("GET")

	// Set up middleware
	router.Use(loggingMiddleware)

	// Create server
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      corsMiddleware.Handler(router),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Server starting on port %s\n", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Could not listen on port %s: %v\n", port, err)
		}
	}()

	// Set up graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Create context with timeout for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Shutdown server
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v\n", err)
	}

	log.Println("Server exited properly")
}

// Middleware for logging requests
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s %s\n", r.RemoteAddr, r.Method, r.URL)
		next.ServeHTTP(w, r)
	})
}
