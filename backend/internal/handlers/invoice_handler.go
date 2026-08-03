package handlers

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/jung-kurt/gofpdf"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
)

// InvoiceRequest represents the request body for invoice operations
type InvoiceRequest struct {
	ClientID      uint       `json:"clientId"`
	Number        string     `json:"number"`
	IssueDate     time.Time  `json:"issueDate"`
	DueDate       time.Time  `json:"dueDate"`
	Status        string     `json:"status"`
	Amount        float64    `json:"amount"`
	Tax           float64    `json:"tax"`
	DueAmount     *float64   `json:"dueAmount"`
	Notes         string     `json:"notes"`
	Subject       string     `json:"subject"`
	Currency      string     `json:"currency"`
	BillerName    string     `json:"billerName"`
	BillerAddress string     `json:"billerAddress"`
	BillerEmail   string     `json:"billerEmail"`
	BillerPhone   string     `json:"billerPhone"`
	ClientName    string     `json:"clientName"`
	ClientAddress string     `json:"clientAddress"`
	ClientEmail   string     `json:"clientEmail"`
	ClientPhone   string     `json:"clientPhone"`
	HarvestID     string     `json:"harvestId"`
	PaidDate      *time.Time `json:"paidDate"`
	PaidAt        *time.Time `json:"paidAt"`
	SentAt        *time.Time `json:"sentAt"`
	ClosedAt      *time.Time `json:"closedAt"`
	TimeEntryIDs  []uint     `json:"timeEntryIds"`
}

type GenerateInvoiceRequest struct {
	ClientID      uint      `json:"clientId"`
	Number        string    `json:"number"`
	StartDate     time.Time `json:"startDate"`
	EndDate       time.Time `json:"endDate"`
	IssueDate     time.Time `json:"issueDate"`
	DueDate       time.Time `json:"dueDate"`
	Notes         string    `json:"notes"`
	Subject       string    `json:"subject"`
	BillerName    string    `json:"billerName"`
	BillerAddress string    `json:"billerAddress"`
	BillerEmail   string    `json:"billerEmail"`
	BillerPhone   string    `json:"billerPhone"`
	ClientName    string    `json:"clientName"`
	ClientAddress string    `json:"clientAddress"`
	ClientEmail   string    `json:"clientEmail"`
	ClientPhone   string    `json:"clientPhone"`
}

// GetInvoices handles retrieving all invoices
func GetInvoices(w http.ResponseWriter, r *http.Request) {
	var invoices []models.Invoice
	if err := database.DB.Preload("Client").Find(&invoices).Error; err != nil {
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
	if err := database.DB.Preload("Client").Preload("TimeEntries.Project").First(&invoice, id).Error; err != nil {
		http.Error(w, "Invoice not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invoice)
}

// GetInvoiceTimeEntries handles retrieving time entries attached to an invoice.
func GetInvoiceTimeEntries(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid invoice ID", http.StatusBadRequest)
		return
	}

	var timeEntries []models.TimeEntry
	if err := database.DB.Preload("Project").Where("invoice_id = ?", id).Order("start_time asc").Find(&timeEntries).Error; err != nil {
		http.Error(w, "Failed to retrieve invoice time entries", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(timeEntries)
}

// GenerateInvoice creates a draft invoice from uninvoiced billable entries for a client and date range.
func GenerateInvoice(w http.ResponseWriter, r *http.Request) {
	var req GenerateInvoiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.ClientID == 0 || req.Number == "" || req.StartDate.IsZero() || req.EndDate.IsZero() {
		http.Error(w, "clientId, number, startDate, and endDate are required", http.StatusBadRequest)
		return
	}
	if req.IssueDate.IsZero() {
		req.IssueDate = time.Now()
	}
	if req.DueDate.IsZero() {
		req.DueDate = req.IssueDate.AddDate(0, 0, 30)
	}

	startInclusive := time.Date(req.StartDate.Year(), req.StartDate.Month(), req.StartDate.Day(), 0, 0, 0, 0, req.StartDate.Location())
	endExclusive := time.Date(req.EndDate.Year(), req.EndDate.Month(), req.EndDate.Day(), 0, 0, 0, 0, req.EndDate.Location()).AddDate(0, 0, 1)
	var entries []models.TimeEntry
	if err := database.DB.
		Preload("Project").
		Joins("JOIN projects ON projects.id = time_entries.project_id").
		Where("projects.client_id = ? AND time_entries.billable = ? AND time_entries.invoice_id IS NULL AND time_entries.start_time >= ? AND time_entries.start_time < ?",
			req.ClientID, true, startInclusive, endExclusive).
		Order("time_entries.start_time asc").
		Find(&entries).Error; err != nil {
		http.Error(w, "Failed to retrieve billable time entries", http.StatusInternalServerError)
		return
	}
	if len(entries) == 0 {
		http.Error(w, "No uninvoiced billable time entries found for that client and date range", http.StatusBadRequest)
		return
	}

	var amount float64
	var entryIDs []uint
	for _, entry := range entries {
		amount += (float64(entry.Duration) / 3600) * entry.Project.Rate
		entryIDs = append(entryIDs, entry.ID)
	}
	amount = roundCurrency(amount)
	var client models.Client
	if err := database.DB.First(&client, req.ClientID).Error; err != nil {
		http.Error(w, "Client not found", http.StatusBadRequest)
		return
	}

	invoice := models.Invoice{
		ClientID:      req.ClientID,
		Number:        req.Number,
		IssueDate:     req.IssueDate,
		DueDate:       req.DueDate,
		Status:        "draft",
		Amount:        amount,
		Tax:           0,
		Total:         amount,
		DueAmount:     amount,
		Notes:         req.Notes,
		Subject:       req.Subject,
		Currency:      "USD",
		BillerName:    defaultInvoiceString(req.BillerName, "Bomhof Integrated LLC"),
		BillerAddress: req.BillerAddress,
		BillerEmail:   req.BillerEmail,
		BillerPhone:   req.BillerPhone,
		ClientName:    defaultInvoiceString(req.ClientName, client.Name),
		ClientAddress: defaultInvoiceString(req.ClientAddress, client.Address),
		ClientEmail:   defaultInvoiceString(req.ClientEmail, client.Email),
		ClientPhone:   defaultInvoiceString(req.ClientPhone, client.Phone),
	}

	tx := database.DB.Begin()
	if err := tx.Create(&invoice).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Failed to create invoice", http.StatusInternalServerError)
		return
	}
	if err := tx.Model(&models.TimeEntry{}).Where("id IN ?", entryIDs).Update("invoice_id", invoice.ID).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Failed to attach time entries to invoice", http.StatusInternalServerError)
		return
	}
	if err := tx.Preload("Client").Preload("TimeEntries.Project").First(&invoice, invoice.ID).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Failed to reload invoice", http.StatusInternalServerError)
		return
	}
	if err := tx.Commit().Error; err != nil {
		http.Error(w, "Failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(invoice)
}

// DownloadInvoicePDF streams a simple invoice PDF that QuickBooks can ingest.
func DownloadInvoicePDF(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid invoice ID", http.StatusBadRequest)
		return
	}

	var invoice models.Invoice
	if err := database.DB.Preload("Client").Preload("TimeEntries.Project").First(&invoice, id).Error; err != nil {
		http.Error(w, "Invoice not found", http.StatusNotFound)
		return
	}

	pdf := buildInvoicePDF(invoice)
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"invoice-%s.pdf\"", invoice.Number))
	if err := pdf.Output(w); err != nil {
		http.Error(w, "Failed to render PDF", http.StatusInternalServerError)
	}
}

func buildInvoicePDF(invoice models.Invoice) *gofpdf.Fpdf {
	pdf := gofpdf.New("P", "mm", "Letter", "")
	pdf.SetMargins(16, 16, 16)
	pdf.AddPage()

	billerName := defaultInvoiceString(invoice.BillerName, "Bomhof Integrated LLC")
	billerAddress := strings.TrimSpace(invoice.BillerAddress)
	billerContact := strings.TrimSpace(strings.TrimSpace(invoice.BillerEmail) + " " + strings.TrimSpace(invoice.BillerPhone))
	clientName := defaultInvoiceString(invoice.ClientName, invoice.Client.Name)
	clientAddress := defaultInvoiceString(invoice.ClientAddress, invoice.Client.Address)
	clientContact := strings.TrimSpace(strings.TrimSpace(defaultInvoiceString(invoice.ClientEmail, invoice.Client.Email)) + " " + strings.TrimSpace(defaultInvoiceString(invoice.ClientPhone, invoice.Client.Phone)))

	pdf.SetFont("Helvetica", "B", 20)
	pdf.Cell(0, 10, billerName)
	pdf.Ln(9)
	pdf.SetFont("Helvetica", "", 10)
	if billerAddress != "" {
		pdf.MultiCell(0, 5, billerAddress, "", "", false)
	}
	if billerContact != "" {
		pdf.Cell(0, 5, billerContact)
		pdf.Ln(5)
	}
	pdf.Cell(0, 5, "Time and services invoice")
	pdf.Ln(12)

	pdf.SetFont("Helvetica", "B", 16)
	pdf.Cell(0, 8, "Invoice "+invoice.Number)
	pdf.Ln(9)
	pdf.SetFont("Helvetica", "", 10)
	pdf.Cell(0, 5, "Issue date: "+invoice.IssueDate.Format("Jan 2, 2006"))
	pdf.Ln(5)
	pdf.Cell(0, 5, "Due date: "+invoice.DueDate.Format("Jan 2, 2006"))
	pdf.Ln(9)
	if strings.TrimSpace(invoice.Subject) != "" {
		pdf.SetFont("Helvetica", "B", 10)
		pdf.Cell(0, 6, "Subject")
		pdf.Ln(6)
		pdf.SetFont("Helvetica", "", 10)
		pdf.MultiCell(0, 5, invoice.Subject, "", "", false)
		pdf.Ln(3)
	}

	pdf.SetFont("Helvetica", "B", 11)
	pdf.Cell(0, 6, "Bill To")
	pdf.Ln(6)
	pdf.SetFont("Helvetica", "", 10)
	billTo := strings.TrimSpace(clientName + "\n" + clientAddress)
	if clientContact != "" {
		billTo = strings.TrimSpace(billTo + "\n" + clientContact)
	}
	pdf.MultiCell(0, 5, billTo, "", "", false)
	pdf.Ln(4)

	pdf.SetFont("Helvetica", "B", 9)
	widths := []float64{24, 50, 72, 18, 22}
	headers := []string{"Date", "Project", "Description", "Hours", "Amount"}
	for i, header := range headers {
		pdf.CellFormat(widths[i], 7, header, "1", 0, "", false, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Helvetica", "", 9)
	for _, entry := range invoice.TimeEntries {
		hours := float64(entry.Duration) / 3600
		amount := roundCurrency(hours * entry.Project.Rate)
		row := []string{
			entry.StartTime.Format("Jan 2"),
			entry.Project.Name,
			entry.Description,
			fmt.Sprintf("%.2f", hours),
			fmt.Sprintf("$%.2f", amount),
		}
		for i, value := range row {
			pdf.CellFormat(widths[i], 6, truncatePDFCell(value, widths[i]), "1", 0, "", false, 0, "")
		}
		pdf.Ln(-1)
	}

	pdf.Ln(5)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.CellFormat(164, 7, "Total", "", 0, "R", false, 0, "")
	pdf.CellFormat(22, 7, fmt.Sprintf("$%.2f", invoice.Total), "T", 0, "R", false, 0, "")
	pdf.Ln(10)

	if strings.TrimSpace(invoice.Notes) != "" {
		pdf.SetFont("Helvetica", "B", 10)
		pdf.Cell(0, 6, "Notes")
		pdf.Ln(6)
		pdf.SetFont("Helvetica", "", 10)
		pdf.MultiCell(0, 5, invoice.Notes, "", "", false)
	}

	return pdf
}

func truncatePDFCell(value string, width float64) string {
	limit := int(width / 2)
	if len(value) <= limit {
		return value
	}
	if limit < 4 {
		return value
	}
	return value[:limit-3] + "..."
}

func roundCurrency(value float64) float64 {
	return math.Round(value*100) / 100
}

func defaultInvoiceString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return strings.TrimSpace(fallback)
	}
	return strings.TrimSpace(value)
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
		ClientID:      req.ClientID,
		Number:        req.Number,
		IssueDate:     req.IssueDate,
		DueDate:       req.DueDate,
		Status:        req.Status,
		Amount:        req.Amount,
		Tax:           req.Tax,
		Notes:         req.Notes,
		Subject:       req.Subject,
		Currency:      req.Currency,
		BillerName:    defaultInvoiceString(req.BillerName, "Bomhof Integrated LLC"),
		BillerAddress: req.BillerAddress,
		BillerEmail:   req.BillerEmail,
		BillerPhone:   req.BillerPhone,
		ClientName:    defaultInvoiceString(req.ClientName, client.Name),
		ClientAddress: defaultInvoiceString(req.ClientAddress, client.Address),
		ClientEmail:   defaultInvoiceString(req.ClientEmail, client.Email),
		ClientPhone:   defaultInvoiceString(req.ClientPhone, client.Phone),
		HarvestID:     req.HarvestID,
		PaidDate:      req.PaidDate,
		PaidAt:        req.PaidAt,
		SentAt:        req.SentAt,
		ClosedAt:      req.ClosedAt,
	}

	// Set default status if not provided
	if invoice.Status == "" {
		invoice.Status = "draft"
	}
	if invoice.Currency == "" {
		invoice.Currency = "USD"
	}

	// Calculate total
	invoice.Total = invoice.Amount + invoice.Tax
	invoice.DueAmount = invoice.Total
	if req.DueAmount != nil {
		invoice.DueAmount = *req.DueAmount
	}

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
	if req.DueAmount != nil {
		invoice.DueAmount = *req.DueAmount
	}
	if req.Notes != "" {
		invoice.Notes = req.Notes
	}
	if req.Subject != "" {
		invoice.Subject = req.Subject
	}
	if req.Currency != "" {
		invoice.Currency = req.Currency
	}
	invoice.BillerName = req.BillerName
	invoice.BillerAddress = req.BillerAddress
	invoice.BillerEmail = req.BillerEmail
	invoice.BillerPhone = req.BillerPhone
	invoice.ClientName = req.ClientName
	invoice.ClientAddress = req.ClientAddress
	invoice.ClientEmail = req.ClientEmail
	invoice.ClientPhone = req.ClientPhone
	if req.HarvestID != "" {
		invoice.HarvestID = req.HarvestID
	}
	if req.PaidDate != nil {
		invoice.PaidDate = req.PaidDate
	}
	if req.PaidAt != nil {
		invoice.PaidAt = req.PaidAt
	}
	if req.SentAt != nil {
		invoice.SentAt = req.SentAt
	}
	if req.ClosedAt != nil {
		invoice.ClosedAt = req.ClosedAt
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
