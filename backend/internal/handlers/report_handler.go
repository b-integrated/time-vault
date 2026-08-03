package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
)

// GetReports returns time entries or invoices for the requested report filters.
func GetReports(w http.ResponseWriter, r *http.Request) {
	reportType := r.URL.Query().Get("type")
	if reportType == "" {
		reportType = "time"
	}

	startDate, endExclusive, err := parseReportDates(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	switch reportType {
	case "time":
		getTimeReport(w, r, startDate, endExclusive)
	case "invoice":
		getInvoiceReport(w, r, startDate, endExclusive)
	default:
		http.Error(w, "Invalid report type", http.StatusBadRequest)
	}
}

func parseReportDates(r *http.Request) (time.Time, time.Time, error) {
	startValue := r.URL.Query().Get("startDate")
	endValue := r.URL.Query().Get("endDate")
	if startValue == "" || endValue == "" {
		return time.Time{}, time.Time{}, errBadReportDate
	}

	startDate, err := time.Parse("2006-01-02", startValue)
	if err != nil {
		return time.Time{}, time.Time{}, errBadReportDate
	}
	endDate, err := time.Parse("2006-01-02", endValue)
	if err != nil {
		return time.Time{}, time.Time{}, errBadReportDate
	}
	return startDate, endDate.AddDate(0, 0, 1), nil
}

var errBadReportDate = reportError("startDate and endDate must use YYYY-MM-DD")

type reportError string

func (e reportError) Error() string {
	return string(e)
}

func getTimeReport(w http.ResponseWriter, r *http.Request, startDate time.Time, endExclusive time.Time) {
	entries, err := queryReportTimeEntries(r, startDate, endExclusive)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func queryReportTimeEntries(r *http.Request, startDate time.Time, endExclusive time.Time) ([]models.TimeEntry, error) {
	query := database.DB.
		Preload("Project").
		Preload("Project.Client").
		Where("time_entries.start_time >= ? AND time_entries.start_time < ?", startDate, endExclusive).
		Order("time_entries.start_time asc")

	if clientID := r.URL.Query().Get("clientId"); clientID != "" {
		parsedID, err := strconv.ParseUint(clientID, 10, 32)
		if err != nil {
			return nil, reportError("Invalid clientId")
		}
		query = query.Joins("JOIN projects ON projects.id = time_entries.project_id").Where("projects.client_id = ?", uint(parsedID))
	}

	if projectID := r.URL.Query().Get("projectId"); projectID != "" {
		parsedID, err := strconv.ParseUint(projectID, 10, 32)
		if err != nil {
			return nil, reportError("Invalid projectId")
		}
		query = query.Where("time_entries.project_id = ?", uint(parsedID))
	}

	var entries []models.TimeEntry
	if err := query.Find(&entries).Error; err != nil {
		return nil, reportError("Failed to generate time report")
	}

	return entries, nil
}

func getInvoiceReport(w http.ResponseWriter, r *http.Request, startDate time.Time, endExclusive time.Time) {
	invoices, err := queryReportInvoices(r, startDate, endExclusive)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(invoices)
}

func queryReportInvoices(r *http.Request, startDate time.Time, endExclusive time.Time) ([]models.Invoice, error) {
	query := database.DB.
		Preload("Client").
		Where("issue_date >= ? AND issue_date < ?", startDate, endExclusive).
		Order("issue_date asc")

	if clientID := r.URL.Query().Get("clientId"); clientID != "" {
		parsedID, err := strconv.ParseUint(clientID, 10, 32)
		if err != nil {
			return nil, reportError("Invalid clientId")
		}
		query = query.Where("client_id = ?", uint(parsedID))
	}
	if status := strings.TrimSpace(r.URL.Query().Get("status")); status != "" && status != "all" {
		query = query.Where("LOWER(status) = LOWER(?)", status)
	}

	var invoices []models.Invoice
	if err := query.Find(&invoices).Error; err != nil {
		return nil, reportError("Failed to generate invoice report")
	}

	return invoices, nil
}

// DownloadReportPDF streams a PDF for the selected report filters.
func DownloadReportPDF(w http.ResponseWriter, r *http.Request) {
	reportType := r.URL.Query().Get("type")
	if reportType == "" {
		reportType = "time"
	}

	startDate, endExclusive, err := parseReportDates(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	endDate := endExclusive.AddDate(0, 0, -1)

	var pdf *gofpdf.Fpdf
	switch reportType {
	case "time":
		entries, err := queryReportTimeEntries(r, startDate, endExclusive)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		pdf = buildTimeReportPDF(entries, startDate, endDate)
	case "invoice":
		invoices, err := queryReportInvoices(r, startDate, endExclusive)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		pdf = buildInvoiceReportPDF(invoices, startDate, endDate)
	default:
		http.Error(w, "Invalid report type", http.StatusBadRequest)
		return
	}

	filename := fmt.Sprintf("%s-report-%s-to-%s.pdf", reportType, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	if err := pdf.Output(w); err != nil {
		http.Error(w, "Failed to render PDF", http.StatusInternalServerError)
	}
}

func buildReportPDF(title string, startDate time.Time, endDate time.Time) *gofpdf.Fpdf {
	pdf := gofpdf.New("P", "mm", "Letter", "")
	pdf.SetMargins(14, 14, 14)
	pdf.AddPage()

	pdf.SetFont("Helvetica", "B", 18)
	pdf.Cell(0, 9, "Bomhof Integrated LLC")
	pdf.Ln(8)
	pdf.SetFont("Helvetica", "", 10)
	pdf.Cell(0, 5, "Time Vault report")
	pdf.Ln(10)

	pdf.SetFont("Helvetica", "B", 15)
	pdf.Cell(0, 8, title)
	pdf.Ln(8)
	pdf.SetFont("Helvetica", "", 10)
	pdf.Cell(0, 5, fmt.Sprintf("Period: %s - %s", startDate.Format("Jan 2, 2006"), endDate.Format("Jan 2, 2006")))
	pdf.Ln(9)

	return pdf
}

func buildTimeReportPDF(entries []models.TimeEntry, startDate time.Time, endDate time.Time) *gofpdf.Fpdf {
	pdf := buildReportPDF("Time Report", startDate, endDate)

	var totalDuration int
	var billableDuration int
	var billableAmount float64
	for _, entry := range entries {
		totalDuration += entry.Duration
		if entry.Billable {
			billableDuration += entry.Duration
			billableAmount += reportEntryAmount(entry)
		}
	}

	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(45, 7, "Total Time", "1", 0, "", false, 0, "")
	pdf.CellFormat(45, 7, "Billable Time", "1", 0, "", false, 0, "")
	pdf.CellFormat(45, 7, "Billable Value", "1", 0, "", false, 0, "")
	pdf.Ln(-1)
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(45, 7, formatReportDuration(totalDuration), "1", 0, "", false, 0, "")
	pdf.CellFormat(45, 7, formatReportDuration(billableDuration), "1", 0, "", false, 0, "")
	pdf.CellFormat(45, 7, fmt.Sprintf("$%.2f", roundCurrency(billableAmount)), "1", 0, "", false, 0, "")
	pdf.Ln(11)

	pdf.SetFont("Helvetica", "B", 8)
	widths := []float64{19, 34, 35, 55, 16, 19, 18}
	headers := []string{"Date", "Client", "Project", "Description", "Hours", "Rate", "Amount"}
	for i, header := range headers {
		pdf.CellFormat(widths[i], 7, header, "1", 0, "", false, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Helvetica", "", 8)
	for _, entry := range entries {
		if pdf.GetY() > 250 {
			pdf.AddPage()
			pdf.SetFont("Helvetica", "B", 8)
			for i, header := range headers {
				pdf.CellFormat(widths[i], 7, header, "1", 0, "", false, 0, "")
			}
			pdf.Ln(-1)
			pdf.SetFont("Helvetica", "", 8)
		}

		rate := ""
		amount := "Non-billable"
		if entry.Billable {
			rate = fmt.Sprintf("$%.2f", entry.Project.Rate)
			amount = fmt.Sprintf("$%.2f", roundCurrency(reportEntryAmount(entry)))
		}
		row := []string{
			entry.StartTime.Format("Jan 2"),
			entry.Project.Client.Name,
			entry.Project.Name,
			strings.TrimSpace(entry.Description),
			fmt.Sprintf("%.2f", float64(entry.Duration)/3600),
			rate,
			amount,
		}
		for i, value := range row {
			pdf.CellFormat(widths[i], 6, truncatePDFCell(value, widths[i]), "1", 0, "", false, 0, "")
		}
		pdf.Ln(-1)
	}

	return pdf
}

func buildInvoiceReportPDF(invoices []models.Invoice, startDate time.Time, endDate time.Time) *gofpdf.Fpdf {
	pdf := buildReportPDF("Invoice Report", startDate, endDate)

	var totalAmount float64
	var paidAmount float64
	var dueAmount float64
	var paidCount int
	var unpaidCount int
	for _, invoice := range invoices {
		totalAmount += invoice.Total
		if invoice.Status == "paid" {
			paidAmount += invoice.Total
			paidCount++
		} else {
			dueAmount += invoice.DueAmount
			unpaidCount++
		}
	}

	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(38, 7, "Invoices", "1", 0, "", false, 0, "")
	pdf.CellFormat(38, 7, "Paid", "1", 0, "", false, 0, "")
	pdf.CellFormat(38, 7, "Unpaid/Draft", "1", 0, "", false, 0, "")
	pdf.CellFormat(38, 7, "Total Value", "1", 0, "", false, 0, "")
	pdf.CellFormat(38, 7, "Due Now", "1", 0, "", false, 0, "")
	pdf.Ln(-1)
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(38, 7, fmt.Sprintf("%d", len(invoices)), "1", 0, "", false, 0, "")
	pdf.CellFormat(38, 7, fmt.Sprintf("%d / $%.2f", paidCount, roundCurrency(paidAmount)), "1", 0, "", false, 0, "")
	pdf.CellFormat(38, 7, fmt.Sprintf("%d", unpaidCount), "1", 0, "", false, 0, "")
	pdf.CellFormat(38, 7, fmt.Sprintf("$%.2f", roundCurrency(totalAmount)), "1", 0, "", false, 0, "")
	pdf.CellFormat(38, 7, fmt.Sprintf("$%.2f", roundCurrency(dueAmount)), "1", 0, "", false, 0, "")
	pdf.Ln(11)

	pdf.SetFont("Helvetica", "B", 8)
	widths := []float64{20, 37, 24, 21, 18, 22, 22, 22, 10}
	headers := []string{"Issue", "Client", "Invoice", "Due", "Status", "Paid Date", "Total", "Due Amt", "PDF"}
	for i, header := range headers {
		pdf.CellFormat(widths[i], 7, header, "1", 0, "", false, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Helvetica", "", 8)
	for _, invoice := range invoices {
		if pdf.GetY() > 250 {
			pdf.AddPage()
			pdf.SetFont("Helvetica", "B", 8)
			for i, header := range headers {
				pdf.CellFormat(widths[i], 7, header, "1", 0, "", false, 0, "")
			}
			pdf.Ln(-1)
			pdf.SetFont("Helvetica", "", 8)
		}

		row := []string{
			invoice.IssueDate.Format("Jan 2"),
			defaultInvoiceString(invoice.ClientName, invoice.Client.Name),
			invoice.Number,
			invoice.DueDate.Format("Jan 2"),
			invoice.Status,
			formatOptionalReportDate(invoice.PaidDate),
			fmt.Sprintf("$%.2f", invoice.Total),
			fmt.Sprintf("$%.2f", invoice.DueAmount),
			"Yes",
		}
		for i, value := range row {
			pdf.CellFormat(widths[i], 6, truncatePDFCell(value, widths[i]), "1", 0, "", false, 0, "")
		}
		pdf.Ln(-1)
	}

	return pdf
}

func reportEntryAmount(entry models.TimeEntry) float64 {
	return (float64(entry.Duration) / 3600) * entry.Project.Rate
}

func formatReportDuration(seconds int) string {
	hours := seconds / 3600
	minutes := (seconds % 3600) / 60
	return fmt.Sprintf("%dh %dm", hours, minutes)
}

func formatOptionalReportDate(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.Format("Jan 2")
}
