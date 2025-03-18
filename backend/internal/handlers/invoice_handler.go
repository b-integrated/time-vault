package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
)

// InvoiceRequest represents the request body for invoice operations
type InvoiceRequest struct {
	ClientID  uint      `json:"clientId"`
	Number    string    `json:"number"`
	IssueDate time.Time `json:"issueDate"`
	DueDate   time.Time `json:"dueDate"`
	Status    string    `json:"status"`
	Amount    float64   `json:"amount"`
	Tax       float64   `json:"tax"`
	Notes     string    `json:"notes"`
	TimeEntryIDs []uint `json:"timeEntryIds"`
}

// GetInvoices handles retrieving all invoices
func GetInvoices(w http.ResponseWriter, r *http.Request) {
	var invoices []models.Invoice
	if err := database.DB.Find(&invoices).Error; err != nil {
		http.Error(w, "Failed to retrieve invoices", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invoices)
}

// GetInvoice handles retrieving a single invoice
func GetInvoice(w http.ResponseWriter, r *http.Request) {
	// Get invoice ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid invoice ID", http.StatusBadRequest)
		return
	}

	// Find invoice
	var invoice models.Invoice
	if err := database.DB.First(&invoice, id).Error; err != nil {
		http.Error(w, "Invoice not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invoice)
}

// GetClientInvoices handles retrieving all invoices for a client
func GetClientInvoices(w http.ResponseWriter, r *http.Request) {
	// Get client ID from URL
	vars := mux.Vars(r)
	clientID, err := strconv.ParseUint(vars["clientId"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid client ID", http.StatusBadRequest)
		return
	}

	// Find invoices for client
	var invoices []models.Invoice
	if err := database.DB.Where("client_id = ?", clientID).Find(&invoices).Error; err != nil {
		http.Error(w, "Failed to retrieve invoices", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invoices)
}

// CreateInvoice handles creating a new invoice
func CreateInvoice(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req InvoiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.ClientID == 0 {
		http.Error(w, "Client ID is required", http.StatusBadRequest)
		return
	}
	if req.Number == "" {
		http.Error(w, "Invoice number is required", http.StatusBadRequest)
		return
	}
	if req.IssueDate.IsZero() {
		http.Error(w, "Issue date is required", http.StatusBadRequest)
		return
	}
	if req.DueDate.IsZero() {
		http.Error(w, "Due date is required", http.StatusBadRequest)
		return
	}

	// Check if client exists
	var client models.Client
	if err := database.DB.First(&client, req.ClientID).Error; err != nil {
		http.Error(w, "Client not found", http.StatusBadRequest)
		return
	}

	// Create invoice
	invoice := models.Invoice{
		ClientID:  req.ClientID,
		Number:    req.Number,
		IssueDate: req.IssueDate,
		DueDate:   req.DueDate,
		Status:    req.Status,
		Amount:    req.Amount,
		Tax:       req.Tax,
		Notes:     req.Notes,
	}

	// Set default status if not provided
	if invoice.Status == "" {
		invoice.Status = "draft"
	}

	// Calculate total
	invoice.Total = invoice.Amount + invoice.Tax

	// Begin transaction
	tx := database.DB.Begin()

	// Create invoice
	if err := tx.Create(&invoice).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Failed to create invoice", http.StatusInternalServerError)
		return
	}

	// Associate time entries with invoice if provided
	if len(req.TimeEntryIDs) > 0 {
		// Update time entries with invoice ID
		if err := tx.Model(&models.TimeEntry{}).Where("id IN ?", req.TimeEntryIDs).Update("invoice_id", invoice.ID).Error; err != nil {
			tx.Rollback()
			http.Error(w, "Failed to associate time entries with invoice", http.StatusInternalServerError)
			return
		}
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(invoice)
}

// UpdateInvoice handles updating an invoice
func UpdateInvoice(w http.ResponseWriter, r *http.Request) {
	// Get invoice ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid invoice ID", http.StatusBadRequest)
		return
	}

	// Find invoice
	var invoice models.Invoice
	if err := database.DB.First(&invoice, id).Error; err != nil {
		http.Error(w, "Invoice not found", http.StatusNotFound)
		return
	}

	// Parse request body
	var req InvoiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Begin transaction
	tx := database.DB.Begin()

	// Update invoice
	if req.ClientID != 0 && req.ClientID != invoice.ClientID {
		// Check if client exists
		var client models.Client
		if err := tx.First(&client, req.ClientID).Error; err != nil {
			tx.Rollback()
			http.Error(w, "Client not found", http.StatusBadRequest)
			return
		}
		invoice.ClientID = req.ClientID
	}

	if req.Number != "" {
		invoice.Number = req.Number
	}
	if !req.IssueDate.IsZero() {
		invoice.IssueDate = req.IssueDate
	}
	if !req.DueDate.IsZero() {
		invoice.DueDate = req.DueDate
	}
	if req.Status != "" {
		invoice.Status = req.Status
	}
	if req.Amount != 0 {
		invoice.Amount = req.Amount
		// Recalculate total
		invoice.Total = invoice.Amount + invoice.Tax
	}
	if req.Tax != 0 {
		invoice.Tax = req.Tax
		// Recalculate total
		invoice.Total = invoice.Amount + invoice.Tax
	}
	if req.Notes != "" {
		invoice.Notes = req.Notes
	}

	// Save changes
	if err := tx.Save(&invoice).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Failed to update invoice", http.StatusInternalServerError)
		return
	}

	// Associate time entries with invoice if provided
	if len(req.TimeEntryIDs) > 0 {
		// Update time entries with invoice ID
		if err := tx.Model(&models.TimeEntry{}).Where("id IN ?", req.TimeEntryIDs).Update("invoice_id", invoice.ID).Error; err != nil {
			tx.Rollback()
			http.Error(w, "Failed to associate time entries with invoice", http.StatusInternalServerError)
			return
		}
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invoice)
}

// DeleteInvoice handles deleting an invoice
func DeleteInvoice(w http.ResponseWriter, r *http.Request) {
	// Get invoice ID from URL
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid invoice ID", http.StatusBadRequest)
		return
	}

	// Find invoice
	var invoice models.Invoice
	if err := database.DB.First(&invoice, id).Error; err != nil {
		http.Error(w, "Invoice not found", http.StatusNotFound)
		return
	}

	// Begin transaction
	tx := database.DB.Begin()

	// Remove invoice ID from associated time entries
	if err := tx.Model(&models.TimeEntry{}).Where("invoice_id = ?", id).Update("invoice_id", nil).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Failed to update time entries", http.StatusInternalServerError)
		return
	}

	// Delete invoice (soft delete)
	if err := tx.Delete(&invoice).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Failed to delete invoice", http.StatusInternalServerError)
		return
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}