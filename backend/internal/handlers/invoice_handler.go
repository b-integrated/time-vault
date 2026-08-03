package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/jung-kurt/gofpdf"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
	"gorm.io/gorm"
)

// InvoiceRequest represents the request body for invoice operations
type InvoiceRequest struct {
	ClientID      uint                 `json:"clientId"`
	Number        string               `json:"number"`
	IssueDate     time.Time            `json:"issueDate"`
	DueDate       time.Time            `json:"dueDate"`
	Status        string               `json:"status"`
	Amount        float64              `json:"amount"`
	Tax           float64              `json:"tax"`
	DueAmount     *float64             `json:"dueAmount"`
	Notes         string               `json:"notes"`
	Subject       string               `json:"subject"`
	Currency      string               `json:"currency"`
	BillerName    string               `json:"billerName"`
	BillerAddress string               `json:"billerAddress"`
	BillerEmail   string               `json:"billerEmail"`
	BillerPhone   string               `json:"billerPhone"`
	ClientName    string               `json:"clientName"`
	ClientAddress string               `json:"clientAddress"`
	ClientEmail   string               `json:"clientEmail"`
	ClientPhone   string               `json:"clientPhone"`
	HarvestID     string               `json:"harvestId"`
	PaidDate      *time.Time           `json:"paidDate"`
	PaidAt        *time.Time           `json:"paidAt"`
	SentAt        *time.Time           `json:"sentAt"`
	ClosedAt      *time.Time           `json:"closedAt"`
	TimeEntryIDs  []uint               `json:"timeEntryIds"`
	Lines         []InvoiceLineRequest `json:"lines"`
}

type InvoiceLineRequest struct {
	ID                  uint       `json:"id"`
	OriginalTimeEntryID *uint      `json:"originalTimeEntryId"`
	ProjectID           *uint      `json:"projectId"`
	ServiceDate         *time.Time `json:"serviceDate"`
	ProjectName         string     `json:"projectName"`
	Description         string     `json:"description"`
	Hours               float64    `json:"hours"`
	Rate                float64    `json:"rate"`
	Amount              float64    `json:"amount"`
	LineType            string     `json:"lineType"`
	SortOrder           int        `json:"sortOrder"`
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
	if err := ensureInvoiceLines(uint(id)); err != nil {
		http.Error(w, "Failed to prepare invoice lines", http.StatusInternalServerError)
		return
	}

	if err := database.DB.Preload("Client").Preload("Lines.OriginalTimeEntry.Project").Preload("Lines.OriginalTimeEntry.Task").Preload("Lines.Project").First(&invoice, id).Error; err != nil {
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

	if err := ensureInvoiceLines(uint(id)); err != nil {
		http.Error(w, "Failed to prepare invoice lines", http.StatusInternalServerError)
		return
	}

	var lines []models.InvoiceLine
	if err := database.DB.Preload("OriginalTimeEntry.Project").Preload("OriginalTimeEntry.Task").Preload("Project").Where("invoice_id = ?", id).Order("sort_order asc, service_date asc, id asc").Find(&lines).Error; err != nil {
		http.Error(w, "Failed to retrieve invoice time entries", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(lines)
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
		Preload("Project.Client").
		Preload("Task").
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
		amount += (float64(entry.Duration) / 3600) * timeEntryRate(entry)
		entryIDs = append(entryIDs, entry.ID)
	}
	amount = roundCurrency(amount)
	var client models.Client
	if err := database.DB.First(&client, req.ClientID).Error; err != nil {
		http.Error(w, "Client not found", http.StatusBadRequest)
		return
	}

	invoiceNumber, err := uniqueInvoiceNumber(database.DB, req.Number, 0)
	if err != nil {
		http.Error(w, "Failed to prepare invoice number", http.StatusInternalServerError)
		return
	}

	invoice := models.Invoice{
		ClientID:      req.ClientID,
		Number:        invoiceNumber,
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
	lines := makeInvoiceLinesFromTimeEntries(invoice.ID, entries)
	if len(lines) > 0 {
		if err := tx.Create(&lines).Error; err != nil {
			tx.Rollback()
			http.Error(w, "Failed to create invoice lines", http.StatusInternalServerError)
			return
		}
	}
	if err := tx.Preload("Client").Preload("Lines.OriginalTimeEntry.Project").Preload("Lines.OriginalTimeEntry.Task").Preload("Lines.Project").First(&invoice, invoice.ID).Error; err != nil {
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
	if err := ensureInvoiceLines(uint(id)); err != nil {
		http.Error(w, "Failed to prepare invoice lines", http.StatusInternalServerError)
		return
	}

	if err := database.DB.Preload("Client").Preload("Lines.OriginalTimeEntry.Project").Preload("Lines.OriginalTimeEntry.Task").Preload("Lines.Project").First(&invoice, id).Error; err != nil {
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

// DownloadInvoiceQBOCSV streams a QuickBooks Online-compatible invoice import CSV.
func DownloadInvoiceQBOCSV(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid invoice ID", http.StatusBadRequest)
		return
	}

	var invoice models.Invoice
	if err := ensureInvoiceLines(uint(id)); err != nil {
		http.Error(w, "Failed to prepare invoice lines", http.StatusInternalServerError)
		return
	}

	if err := database.DB.Preload("Client").Preload("Lines.OriginalTimeEntry.Project").Preload("Lines.OriginalTimeEntry.Task").Preload("Lines.Project").First(&invoice, id).Error; err != nil {
		http.Error(w, "Invoice not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"invoice-%s-qbo.csv\"", invoice.Number))
	writer := csv.NewWriter(w)
	if err := writeInvoiceQBOCSV(writer, invoice); err != nil {
		http.Error(w, "Failed to render QuickBooks CSV", http.StatusInternalServerError)
		return
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		http.Error(w, "Failed to render QuickBooks CSV", http.StatusInternalServerError)
	}
}

func writeInvoiceQBOCSV(writer *csv.Writer, invoice models.Invoice) error {
	header := []string{"*InvoiceNo", "*Customer", "*InvoiceDate", "*DueDate", "Terms", "Location", "Memo", "Item(Product/Service)", "ItemDescription", "ItemQuantity", "ItemRate", "*ItemAmount", "Service Date"}
	if err := writer.Write(header); err != nil {
		return err
	}

	customer := defaultInvoiceString(invoice.ClientName, invoice.Client.Name)
	invoiceDate := formatQBODate(invoice.IssueDate)
	dueDate := formatQBODate(invoice.DueDate)
	terms := qboTerms(invoice.IssueDate, invoice.DueDate)
	memo := normalizeQBOText(invoice.Subject)
	if strings.TrimSpace(invoice.Notes) != "" {
		memo = normalizeQBOText(strings.TrimSpace(memo) + " " + strings.TrimSpace(invoice.Notes))
	}

	for index, line := range invoice.Lines {
		row := make([]string, len(header))
		row[0] = invoice.Number
		if index == 0 {
			row[1] = customer
			row[2] = invoiceDate
			row[3] = dueDate
			row[4] = terms
			row[6] = memo
		}
		row[7] = normalizeQBOText(qboItemName(line))
		row[8] = normalizeQBOText(line.Description)
		row[9] = formatQBONumber(line.Hours)
		row[10] = formatQBONumber(line.Rate)
		row[11] = formatQBONumber(line.Amount)
		if line.ServiceDate != nil {
			row[12] = formatQBODate(*line.ServiceDate)
		}
		if err := writer.Write(row); err != nil {
			return err
		}
	}

	return nil
}

func normalizeQBOText(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func qboItemName(_ models.InvoiceLine) string {
	return "Services"
}

func qboTerms(issueDate time.Time, dueDate time.Time) string {
	if issueDate.IsZero() || dueDate.IsZero() {
		return ""
	}
	days := int(dueDate.Sub(issueDate).Hours() / 24)
	if days <= 0 {
		return "Due on receipt"
	}
	return fmt.Sprintf("Net %d", days)
}

func formatQBODate(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format("1/2/2006")
}

func formatQBONumber(value float64) string {
	formatted := strconv.FormatFloat(roundCurrency(value), 'f', 2, 64)
	return strings.TrimRight(strings.TrimRight(formatted, "0"), ".")
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

	widths := []float64{22, 34, 66, 16, 20, 28}
	headers := []string{"Date", "Project", "Description", "Hours", "Rate", "Amount"}
	drawInvoiceLineHeader(pdf, widths, headers)

	for _, line := range invoice.Lines {
		serviceDate := ""
		if line.ServiceDate != nil {
			serviceDate = line.ServiceDate.Format("Jan 2")
		}
		projectName := line.ProjectName
		if projectName == "" && line.Project != nil {
			projectName = line.Project.Name
		}
		row := []string{
			serviceDate,
			projectName,
			line.Description,
			fmt.Sprintf("%.2f", line.Hours),
			fmt.Sprintf("$%.2f", line.Rate),
			fmt.Sprintf("$%.2f", line.Amount),
		}
		drawInvoiceLineRow(pdf, widths, headers, row)
	}

	pdf.Ln(5)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.CellFormat(158, 7, "Total", "", 0, "R", false, 0, "")
	pdf.CellFormat(28, 7, fmt.Sprintf("$%.2f", invoice.Total), "T", 0, "R", false, 0, "")
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

func drawInvoiceLineHeader(pdf *gofpdf.Fpdf, widths []float64, headers []string) {
	pdf.SetFont("Helvetica", "B", 9)
	for i, header := range headers {
		pdf.CellFormat(widths[i], 7, header, "1", 0, "", false, 0, "")
	}
	pdf.Ln(-1)
	pdf.SetFont("Helvetica", "", 9)
}

func drawInvoiceLineRow(pdf *gofpdf.Fpdf, widths []float64, headers []string, row []string) {
	lineHeight := 5.0
	rowHeight := lineHeight
	for i, value := range row {
		lines := pdf.SplitLines([]byte(strings.TrimSpace(value)), widths[i]-2)
		if len(lines) == 0 {
			continue
		}
		cellHeight := float64(len(lines)) * lineHeight
		if cellHeight > rowHeight {
			rowHeight = cellHeight
		}
	}
	rowHeight += 2

	if pdf.GetY()+rowHeight > 252 {
		pdf.AddPage()
		drawInvoiceLineHeader(pdf, widths, headers)
	}

	x := pdf.GetX()
	y := pdf.GetY()
	for i, value := range row {
		pdf.Rect(x, y, widths[i], rowHeight, "")
		pdf.SetXY(x+1, y+1)
		align := "L"
		if i >= 3 {
			align = "R"
		}
		pdf.MultiCell(widths[i]-2, lineHeight, strings.TrimSpace(value), "", align, false)
		x += widths[i]
	}
	pdf.SetXY(16, y+rowHeight)
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

var invoiceSequenceSuffix = regexp.MustCompile(`-\d{4}$`)
var generatedInvoiceNumberPattern = regexp.MustCompile(`^INV-(\d{4})-(\d{2})(?:-([A-Z0-9-]+))?-(\d{4})$`)
var nonInvoiceSlugCharacter = regexp.MustCompile(`[^A-Z0-9]+`)

func compactGeneratedInvoiceNumber(requested string) string {
	base := strings.ToUpper(strings.TrimSpace(requested))
	matches := generatedInvoiceNumberPattern.FindStringSubmatch(base)
	if matches == nil {
		return strings.TrimSpace(requested)
	}

	slug := nonInvoiceSlugCharacter.ReplaceAllString(matches[3], "")
	if len(slug) > 7 {
		slug = slug[:7]
	}
	if slug == "" {
		return fmt.Sprintf("INV-%s%s-%s", matches[1][2:], matches[2], matches[4])
	}
	return fmt.Sprintf("INV-%s%s-%s-%s", matches[1][2:], matches[2], slug, matches[4])
}

func uniqueInvoiceNumber(db *gorm.DB, requested string, excludeID uint) (string, error) {
	base := compactGeneratedInvoiceNumber(requested)
	if base == "" {
		return "", fmt.Errorf("invoice number is required")
	}

	sequenceBase := invoiceSequenceSuffix.ReplaceAllString(base, "")
	for i := 0; i <= 9999; i++ {
		candidate := base
		if i > 0 {
			candidate = fmt.Sprintf("%s-%04d", sequenceBase, i)
		}

		query := db.Model(&models.Invoice{}).Where("number = ?", candidate)
		if excludeID != 0 {
			query = query.Where("id <> ?", excludeID)
		}

		var count int64
		if err := query.Count(&count).Error; err != nil {
			return "", err
		}
		if count == 0 {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("could not generate a unique invoice number for %s", base)
}

func defaultInvoiceString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return strings.TrimSpace(fallback)
	}
	return strings.TrimSpace(value)
}

func makeInvoiceLinesFromTimeEntries(invoiceID uint, entries []models.TimeEntry) []models.InvoiceLine {
	lines := make([]models.InvoiceLine, 0, len(entries))
	for index, entry := range entries {
		entryID := entry.ID
		projectID := entry.ProjectID
		serviceDate := entry.StartTime
		hours := roundHours(float64(entry.Duration) / 3600)
		rate := timeEntryRate(entry)
		amount := roundCurrency(hours * rate)
		lines = append(lines, models.InvoiceLine{
			InvoiceID:           invoiceID,
			OriginalTimeEntryID: &entryID,
			ProjectID:           &projectID,
			ServiceDate:         &serviceDate,
			ProjectName:         entry.Project.Name,
			Description:         invoiceLineDescriptionFromTimeEntry(entry),
			Hours:               hours,
			Rate:                rate,
			Amount:              amount,
			LineType:            "time",
			SortOrder:           index,
		})
	}
	return lines
}

func roundHours(value float64) float64 {
	return math.Round(value*100) / 100
}

func timeEntryRate(entry models.TimeEntry) float64 {
	if entry.Task != nil && entry.Task.Rate > 0 {
		return entry.Task.Rate
	}
	return entry.Project.Rate
}

func invoiceLineDescriptionFromTimeEntry(entry models.TimeEntry) string {
	context := invoiceLineContextFromTimeEntry(entry)
	description := strings.TrimSpace(entry.Description)
	if context == "" {
		return description
	}
	if description == "" {
		return context
	}
	if strings.HasPrefix(description, context+"\n") || strings.HasPrefix(description, context+" - ") {
		return description
	}
	return context + "\n" + description
}

func invoiceLineContextFromTimeEntry(entry models.TimeEntry) string {
	parts := []string{}
	if entry.Project.Client.Name != "" {
		parts = append(parts, entry.Project.Client.Name)
	}
	if entry.Project.Name != "" {
		parts = append(parts, entry.Project.Name)
	}
	if entry.Task != nil && entry.Task.Name != "" {
		parts = append(parts, entry.Task.Name)
	}
	return strings.Join(parts, " / ")
}

func ensureInvoiceLines(invoiceID uint) error {
	var lineCount int64
	if err := database.DB.Model(&models.InvoiceLine{}).Where("invoice_id = ?", invoiceID).Count(&lineCount).Error; err != nil {
		return err
	}
	if lineCount > 0 {
		return nil
	}

	var entries []models.TimeEntry
	if err := database.DB.Preload("Project").Preload("Project.Client").Preload("Task").Where("invoice_id = ?", invoiceID).Order("start_time asc").Find(&entries).Error; err != nil {
		return err
	}
	if len(entries) == 0 {
		return nil
	}

	lines := makeInvoiceLinesFromTimeEntries(invoiceID, entries)
	return database.DB.Create(&lines).Error
}

func invoiceLineFromRequest(invoiceID uint, req InvoiceLineRequest, sortOrder int) models.InvoiceLine {
	lineType := defaultInvoiceString(req.LineType, "manual")
	amount := req.Amount
	if amount == 0 && req.Hours != 0 && req.Rate != 0 {
		amount = roundCurrency(req.Hours * req.Rate)
	}
	if req.SortOrder != 0 {
		sortOrder = req.SortOrder
	}
	return models.InvoiceLine{
		ID:                  req.ID,
		InvoiceID:           invoiceID,
		OriginalTimeEntryID: req.OriginalTimeEntryID,
		ProjectID:           req.ProjectID,
		ServiceDate:         req.ServiceDate,
		ProjectName:         req.ProjectName,
		Description:         req.Description,
		Hours:               roundHours(req.Hours),
		Rate:                req.Rate,
		Amount:              roundCurrency(amount),
		LineType:            lineType,
		SortOrder:           sortOrder,
	}
}

func replaceInvoiceLines(tx *gorm.DB, invoiceID uint, lineReqs []InvoiceLineRequest) (float64, []uint, error) {
	var existing []models.InvoiceLine
	if err := tx.Where("invoice_id = ?", invoiceID).Find(&existing).Error; err != nil {
		return 0, nil, err
	}

	var oldEntryIDs []uint
	for _, line := range existing {
		if line.OriginalTimeEntryID != nil {
			oldEntryIDs = append(oldEntryIDs, *line.OriginalTimeEntryID)
		}
	}
	if len(oldEntryIDs) > 0 {
		if err := tx.Model(&models.TimeEntry{}).Where("id IN ?", oldEntryIDs).Update("invoice_id", nil).Error; err != nil {
			return 0, nil, err
		}
	}

	if err := tx.Where("invoice_id = ?", invoiceID).Delete(&models.InvoiceLine{}).Error; err != nil {
		return 0, nil, err
	}

	lines := make([]models.InvoiceLine, 0, len(lineReqs))
	var newEntryIDs []uint
	var amount float64
	for index, lineReq := range lineReqs {
		line := invoiceLineFromRequest(invoiceID, lineReq, index)
		line.ID = 0
		if line.OriginalTimeEntryID != nil {
			newEntryIDs = append(newEntryIDs, *line.OriginalTimeEntryID)
			line.LineType = "time"
			if line.ProjectName == "" || line.ProjectID == nil || line.ServiceDate == nil || line.Rate == 0 {
				var entry models.TimeEntry
				if err := tx.Preload("Project").Preload("Project.Client").Preload("Task").First(&entry, *line.OriginalTimeEntryID).Error; err != nil {
					return 0, nil, err
				}
				if line.ProjectID == nil {
					projectID := entry.ProjectID
					line.ProjectID = &projectID
				}
				if line.ServiceDate == nil {
					serviceDate := entry.StartTime
					line.ServiceDate = &serviceDate
				}
				if line.ProjectName == "" {
					line.ProjectName = entry.Project.Name
				}
				if line.Rate == 0 {
					line.Rate = timeEntryRate(entry)
				}
				if line.Description == "" {
					line.Description = invoiceLineDescriptionFromTimeEntry(entry)
				}
			}
		}
		line.Amount = roundCurrency(line.Amount)
		amount += line.Amount
		lines = append(lines, line)
	}
	if len(lines) > 0 {
		if err := tx.Create(&lines).Error; err != nil {
			return 0, nil, err
		}
	}
	if len(newEntryIDs) > 0 {
		if err := tx.Model(&models.TimeEntry{}).Where("id IN ?", newEntryIDs).Update("invoice_id", invoiceID).Error; err != nil {
			return 0, nil, err
		}
	}

	return roundCurrency(amount), newEntryIDs, nil
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

	invoiceNumber, err := uniqueInvoiceNumber(database.DB, req.Number, 0)
	if err != nil {
		http.Error(w, "Failed to prepare invoice number", http.StatusInternalServerError)
		return
	}

	// Create invoice
	invoice := models.Invoice{
		ClientID:      req.ClientID,
		Number:        invoiceNumber,
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
		HarvestID:     strings.TrimSpace(req.HarvestID),
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

	if len(req.Lines) > 0 {
		invoice.Amount = 0
		for _, line := range req.Lines {
			invoice.Amount += roundCurrency(line.Amount)
		}
		invoice.Amount = roundCurrency(invoice.Amount)
	}

	// Calculate total
	invoice.Total = roundCurrency(invoice.Amount + invoice.Tax)
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

	if len(req.Lines) > 0 {
		amount, _, err := replaceInvoiceLines(tx, invoice.ID, req.Lines)
		if err != nil {
			tx.Rollback()
			http.Error(w, "Failed to save invoice lines", http.StatusInternalServerError)
			return
		}
		invoice.Amount = amount
		invoice.Total = roundCurrency(invoice.Amount + invoice.Tax)
		invoice.DueAmount = invoice.Total
		if req.DueAmount != nil {
			invoice.DueAmount = *req.DueAmount
		}
		if err := tx.Save(&invoice).Error; err != nil {
			tx.Rollback()
			http.Error(w, "Failed to update invoice totals", http.StatusInternalServerError)
			return
		}
	} else if len(req.TimeEntryIDs) > 0 {
		var entries []models.TimeEntry
		if err := tx.Preload("Project").Preload("Project.Client").Preload("Task").Where("id IN ?", req.TimeEntryIDs).Order("start_time asc").Find(&entries).Error; err != nil {
			tx.Rollback()
			http.Error(w, "Failed to retrieve invoice time entries", http.StatusInternalServerError)
			return
		}
		lines := makeInvoiceLinesFromTimeEntries(invoice.ID, entries)
		if len(lines) > 0 {
			if err := tx.Create(&lines).Error; err != nil {
				tx.Rollback()
				http.Error(w, "Failed to create invoice lines", http.StatusInternalServerError)
				return
			}
		}
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

	if req.Number != "" && req.Number != invoice.Number {
		number, err := uniqueInvoiceNumber(tx, req.Number, invoice.ID)
		if err != nil {
			tx.Rollback()
			http.Error(w, "Failed to prepare invoice number", http.StatusInternalServerError)
			return
		}
		invoice.Number = number
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
	invoice.Amount = req.Amount
	invoice.Tax = req.Tax
	invoice.Total = roundCurrency(invoice.Amount + invoice.Tax)
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

	if len(req.Lines) > 0 {
		amount, _, err := replaceInvoiceLines(tx, invoice.ID, req.Lines)
		if err != nil {
			tx.Rollback()
			http.Error(w, "Failed to save invoice lines", http.StatusInternalServerError)
			return
		}
		invoice.Amount = amount
		invoice.Total = roundCurrency(invoice.Amount + invoice.Tax)
		if req.DueAmount == nil {
			invoice.DueAmount = invoice.Total
		}
	}

	// Save changes
	if err := tx.Save(&invoice).Error; err != nil {
		tx.Rollback()
		http.Error(w, "Failed to update invoice", http.StatusInternalServerError)
		return
	}

	// Associate time entries with invoice if provided by the legacy client path.
	if len(req.Lines) == 0 && len(req.TimeEntryIDs) > 0 {
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
	if err := database.DB.Preload("Client").Preload("Lines.OriginalTimeEntry.Project").Preload("Lines.OriginalTimeEntry.Task").Preload("Lines.Project").First(&invoice, invoice.ID).Error; err != nil {
		http.Error(w, "Failed to reload invoice", http.StatusInternalServerError)
		return
	}
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
