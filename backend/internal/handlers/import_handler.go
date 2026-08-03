package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/timevault/backend/internal/database"
	"github.com/timevault/backend/internal/models"
	"gorm.io/gorm"
)

type HarvestImportResult struct {
	RowsRead         int      `json:"rowsRead"`
	Imported         int      `json:"imported"`
	Updated          int      `json:"updated"`
	Skipped          int      `json:"skipped"`
	ClientsUpserted  int      `json:"clientsUpserted"`
	ProjectsUpserted int      `json:"projectsUpserted"`
	InvoicesUpserted int      `json:"invoicesUpserted"`
	DryRun           bool     `json:"dryRun"`
	ImportType       string   `json:"importType"`
	Errors           []string `json:"errors"`
}

type harvestInvoiceInput struct {
	ID            int64                    `json:"id"`
	Number        string                   `json:"number"`
	Amount        float64                  `json:"amount"`
	DueAmount     float64                  `json:"due_amount"`
	TaxAmount     float64                  `json:"tax_amount"`
	Subject       string                   `json:"subject"`
	Notes         string                   `json:"notes"`
	BillerName    string                   `json:"biller_name"`
	BillerAddress string                   `json:"biller_address"`
	BillerEmail   string                   `json:"biller_email"`
	BillerPhone   string                   `json:"biller_phone"`
	ClientName    string                   `json:"client_name"`
	ClientAddress string                   `json:"client_address"`
	ClientEmail   string                   `json:"client_email"`
	ClientPhone   string                   `json:"client_phone"`
	State         string                   `json:"state"`
	IssueDate     string                   `json:"issue_date"`
	DueDate       string                   `json:"due_date"`
	SentAt        *string                  `json:"sent_at"`
	PaidAt        *string                  `json:"paid_at"`
	ClosedAt      *string                  `json:"closed_at"`
	PaidDate      *string                  `json:"paid_date"`
	Currency      string                   `json:"currency"`
	Client        harvestClientRef         `json:"client"`
	LineItems     []harvestInvoiceLineItem `json:"line_items"`
}

type harvestClientRef struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Address string `json:"address"`
	Email   string `json:"email"`
	Phone   string `json:"phone"`
}

type harvestInvoiceLineItem struct {
	ID          int64             `json:"id"`
	Kind        string            `json:"kind"`
	Description string            `json:"description"`
	Quantity    float64           `json:"quantity"`
	UnitPrice   float64           `json:"unit_price"`
	Amount      float64           `json:"amount"`
	Project     harvestProjectRef `json:"project"`
}

type harvestProjectRef struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
}

// ImportHarvestTime imports a Harvest time report CSV into clients, projects, and time entries.
func ImportHarvestTime(w http.ResponseWriter, r *http.Request) {
	handleHarvestTimeImport(w, r, false)
}

// PreviewHarvestTime validates a Harvest time report CSV without changing data.
func PreviewHarvestTime(w http.ResponseWriter, r *http.Request) {
	handleHarvestTimeImport(w, r, true)
}

func handleHarvestTimeImport(w http.ResponseWriter, r *http.Request, dryRun bool) {
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		http.Error(w, "Expected multipart form with a CSV file", http.StatusBadRequest)
		return
	}

	userID, err := parseImportUserID(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "CSV file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	result := importHarvestCSV(file, userID, dryRun)
	writeImportResult(w, result, http.StatusCreated)
}

// ImportHarvestInvoices imports a Harvest invoice JSON export into invoices.
func ImportHarvestInvoices(w http.ResponseWriter, r *http.Request) {
	handleHarvestInvoiceImport(w, r, false)
}

// PreviewHarvestInvoices validates a Harvest invoice JSON export without changing data.
func PreviewHarvestInvoices(w http.ResponseWriter, r *http.Request) {
	handleHarvestInvoiceImport(w, r, true)
}

func handleHarvestInvoiceImport(w http.ResponseWriter, r *http.Request, dryRun bool) {
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		http.Error(w, "Expected multipart form with a JSON file", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Harvest invoice JSON file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	result := importHarvestInvoiceJSON(file, dryRun)
	writeImportResult(w, result, http.StatusCreated)
}

func writeImportResult(w http.ResponseWriter, result HarvestImportResult, successStatus int) {
	w.Header().Set("Content-Type", "application/json")
	status := successStatus
	if result.DryRun {
		status = http.StatusOK
	}
	if len(result.Errors) > 0 && result.Imported == 0 {
		status = http.StatusBadRequest
	}
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(result)
}

func parseImportUserID(r *http.Request) (uint, error) {
	raw := strings.TrimSpace(r.FormValue("userId"))
	if raw == "" {
		var user models.User
		if err := database.DB.Order("id asc").First(&user).Error; err != nil {
			return 0, fmt.Errorf("userId is required until a user exists")
		}
		return user.ID, nil
	}

	id, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || id == 0 {
		return 0, fmt.Errorf("invalid userId")
	}

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		return 0, fmt.Errorf("user not found")
	}
	return uint(id), nil
}

func importHarvestCSV(reader io.Reader, userID uint, dryRun bool) HarvestImportResult {
	csvReader := csv.NewReader(reader)
	csvReader.FieldsPerRecord = -1
	csvReader.TrimLeadingSpace = true

	headers, err := csvReader.Read()
	if err != nil {
		return HarvestImportResult{DryRun: dryRun, ImportType: "time", Errors: []string{"Could not read CSV header"}}
	}

	index := make(map[string]int)
	for i, header := range headers {
		index[normalizeHeader(header)] = i
	}

	result := HarvestImportResult{DryRun: dryRun, ImportType: "time"}
	seenClients := map[string]bool{}
	seenProjects := map[string]bool{}
	seenTasks := map[string]bool{}

	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Row %d: %v", result.RowsRead+2, err))
			result.Skipped++
			continue
		}

		result.RowsRead++
		clientName := firstValue(record, index, "client", "clientname")
		projectName := firstValue(record, index, "project", "projectname")
		taskName := firstValue(record, index, "task", "taskname")
		description := firstValue(record, index, "notes", "note", "description", "task")
		harvestID := firstValue(record, index, "harvestid", "harvestentryid", "entryid", "id")
		if clientName == "" || projectName == "" {
			result.Errors = append(result.Errors, fmt.Sprintf("Row %d: client and project are required", result.RowsRead+1))
			result.Skipped++
			continue
		}

		startTime, durationSeconds, err := parseHarvestTime(record, index)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Row %d: %v", result.RowsRead+1, err))
			result.Skipped++
			continue
		}

		billable := parseBillable(firstValue(record, index, "billable", "billable?", "isbillable"))
		rate := parseMoney(firstValue(record, index, "billablerate", "projectrate", "rate", "hourlyrate"))

		client, createdClient, err := findOrCreateClient(clientName, dryRun)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Row %d: %v", result.RowsRead+1, err))
			result.Skipped++
			continue
		}
		clientKey := normalizeHeader(clientName)
		if createdClient || !seenClients[clientKey] {
			seenClients[clientKey] = true
			result.ClientsUpserted++
		}

		project, createdProject, err := findOrCreateProject(projectName, client.ID, clientName, rate, dryRun)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Row %d: %v", result.RowsRead+1, err))
			result.Skipped++
			continue
		}
		projectKey := normalizeHeader(clientName + ":" + projectName)
		if createdProject || !seenProjects[projectKey] {
			seenProjects[projectKey] = true
			result.ProjectsUpserted++
		}

		if taskName == "" {
			taskName = "General"
		}
		task, createdTask, err := findOrCreateTask(taskName, project.ID, billable, rate, dryRun)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Row %d: %v", result.RowsRead+1, err))
			result.Skipped++
			continue
		}
		taskKey := normalizeHeader(fmt.Sprintf("%d:%s", project.ID, taskName))
		if createdTask || !seenTasks[taskKey] {
			seenTasks[taskKey] = true
		}

		endTime := startTime.Add(time.Duration(durationSeconds) * time.Second)
		taskID := task.ID
		timeEntry := models.TimeEntry{
			UserID:      userID,
			ProjectID:   project.ID,
			TaskID:      &taskID,
			Description: description,
			StartTime:   startTime,
			EndTime:     endTime,
			Duration:    durationSeconds,
			Billable:    billable,
			HarvestID:   harvestID,
		}

		exists, err := existingTimeEntry(userID, project.ID, startTime, durationSeconds, description, harvestID)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Row %d: failed duplicate check", result.RowsRead+1))
			result.Skipped++
			continue
		}
		if exists {
			result.Skipped++
			continue
		}

		if dryRun {
			result.Imported++
			continue
		}
		if err := database.DB.Create(&timeEntry).Error; err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Row %d: failed to create time entry", result.RowsRead+1))
			result.Skipped++
			continue
		}
		result.Imported++
	}

	return result
}

func existingTimeEntry(userID uint, projectID uint, startTime time.Time, durationSeconds int, description string, harvestID string) (bool, error) {
	var existing models.TimeEntry
	var err error
	if harvestID != "" {
		err = database.DB.Where("user_id = ? AND harvest_id = ?", userID, harvestID).First(&existing).Error
	} else if projectID != 0 {
		err = database.DB.Where(
			"user_id = ? AND project_id = ? AND start_time = ? AND duration = ? AND description = ?",
			userID, projectID, startTime, durationSeconds, description,
		).First(&existing).Error
	} else {
		return false, nil
	}
	if err == nil {
		return true, nil
	}
	if err == gorm.ErrRecordNotFound {
		return false, nil
	}
	return false, err
}

func findOrCreateClient(name string, dryRun bool) (models.Client, bool, error) {
	var client models.Client
	err := database.DB.Where("LOWER(name) = LOWER(?)", name).First(&client).Error
	if err == nil {
		return client, false, nil
	}
	if err != gorm.ErrRecordNotFound {
		return client, false, err
	}
	if dryRun {
		return models.Client{Name: name}, true, nil
	}

	client = models.Client{Name: name}
	return client, true, database.DB.Create(&client).Error
}

func findOrCreateTask(name string, projectID uint, billable bool, rate float64, dryRun bool) (models.Task, bool, error) {
	var task models.Task
	err := database.DB.Where("project_id = ? AND LOWER(name) = LOWER(?)", projectID, name).First(&task).Error
	if err == nil {
		if !dryRun {
			changed := false
			if task.Rate == 0 && rate > 0 {
				task.Rate = rate
				changed = true
			}
			if task.Status == "" {
				task.Status = "active"
				changed = true
			}
			if changed {
				if saveErr := database.DB.Save(&task).Error; saveErr != nil {
					return task, false, saveErr
				}
			}
		}
		return task, false, nil
	}
	if err != gorm.ErrRecordNotFound {
		return task, false, err
	}
	if dryRun {
		return models.Task{Name: name, ProjectID: projectID, Billable: billable, Rate: rate, Status: "active"}, true, nil
	}

	task = models.Task{
		Name:      name,
		ProjectID: projectID,
		Billable:  billable,
		Rate:      rate,
		Status:    "active",
	}
	return task, true, database.DB.Create(&task).Error
}

func findOrCreateProject(name string, clientID uint, clientName string, rate float64, dryRun bool) (models.Project, bool, error) {
	var project models.Project
	query := database.DB.Where("LOWER(name) = LOWER(?)", name)
	if clientID != 0 {
		query = query.Where("client_id = ?", clientID)
	} else {
		query = query.Joins("JOIN clients ON clients.id = projects.client_id").Where("LOWER(clients.name) = LOWER(?)", clientName)
	}
	err := query.First(&project).Error
	if err == nil {
		if !dryRun && project.Rate == 0 && rate > 0 {
			project.Rate = rate
			if saveErr := database.DB.Save(&project).Error; saveErr != nil {
				return project, false, saveErr
			}
		}
		return project, false, nil
	}
	if err != gorm.ErrRecordNotFound {
		return project, false, err
	}
	if dryRun {
		return models.Project{Name: name, ClientID: clientID, Rate: rate, Status: "active"}, true, nil
	}

	project = models.Project{
		Name:     name,
		ClientID: clientID,
		Rate:     rate,
		Status:   "active",
	}
	return project, true, database.DB.Create(&project).Error
}

func importHarvestInvoiceJSON(reader io.Reader, dryRun bool) HarvestImportResult {
	var invoices []harvestInvoiceInput
	if err := json.NewDecoder(reader).Decode(&invoices); err != nil {
		return HarvestImportResult{DryRun: dryRun, ImportType: "invoices", Errors: []string{"Could not read Harvest invoice JSON"}}
	}

	result := HarvestImportResult{RowsRead: len(invoices), DryRun: dryRun, ImportType: "invoices"}
	seenClients := map[string]bool{}
	for index, input := range invoices {
		row := index + 1
		if strings.TrimSpace(input.Number) == "" {
			result.Errors = append(result.Errors, fmt.Sprintf("Invoice row %d: number is required", row))
			result.Skipped++
			continue
		}
		if strings.TrimSpace(input.Client.Name) == "" {
			result.Errors = append(result.Errors, fmt.Sprintf("Invoice %s: client is required", input.Number))
			result.Skipped++
			continue
		}

		issueDate, err := parseOptionalDate(input.IssueDate)
		if err != nil || issueDate == nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Invoice %s: issue_date is required", input.Number))
			result.Skipped++
			continue
		}
		dueDate, err := parseOptionalDate(input.DueDate)
		if err != nil || dueDate == nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Invoice %s: due_date is required", input.Number))
			result.Skipped++
			continue
		}

		client, createdClient, err := findOrCreateClient(input.Client.Name, dryRun)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Invoice %s: %v", input.Number, err))
			result.Skipped++
			continue
		}
		clientKey := normalizeHeader(input.Client.Name)
		if createdClient || !seenClients[clientKey] {
			seenClients[clientKey] = true
			result.ClientsUpserted++
		}

		harvestID := ""
		if input.ID != 0 {
			harvestID = strconv.FormatInt(input.ID, 10)
		}
		invoice := models.Invoice{
			ClientID:      client.ID,
			Number:        input.Number,
			IssueDate:     *issueDate,
			DueDate:       *dueDate,
			Status:        normalizeInvoiceStatus(input.State),
			Amount:        roundCurrency(input.Amount),
			Tax:           roundCurrency(input.TaxAmount),
			Total:         roundCurrency(input.Amount + input.TaxAmount),
			DueAmount:     roundCurrency(input.DueAmount),
			Notes:         input.Notes,
			Subject:       input.Subject,
			Currency:      defaultString(input.Currency, "USD"),
			BillerName:    defaultString(input.BillerName, "Bomhof Integrated LLC"),
			BillerAddress: strings.TrimSpace(input.BillerAddress),
			BillerEmail:   strings.TrimSpace(input.BillerEmail),
			BillerPhone:   strings.TrimSpace(input.BillerPhone),
			ClientName:    defaultString(input.ClientName, defaultString(input.Client.Name, client.Name)),
			ClientAddress: defaultString(input.ClientAddress, input.Client.Address),
			ClientEmail:   defaultString(input.ClientEmail, input.Client.Email),
			ClientPhone:   defaultString(input.ClientPhone, input.Client.Phone),
			HarvestID:     harvestID,
			PaidDate:      mustParseOptionalDate(input.PaidDate),
			PaidAt:        mustParseOptionalTimestamp(input.PaidAt),
			SentAt:        mustParseOptionalTimestamp(input.SentAt),
			ClosedAt:      mustParseOptionalTimestamp(input.ClosedAt),
		}

		var existing models.Invoice
		if harvestID != "" {
			err = database.DB.Where("harvest_id = ? OR number = ?", harvestID, input.Number).First(&existing).Error
		} else {
			err = database.DB.Where("number = ?", input.Number).First(&existing).Error
		}
		if err == nil {
			if dryRun {
				result.Updated++
				continue
			}
			updates := map[string]interface{}{
				"client_id":      invoice.ClientID,
				"number":         invoice.Number,
				"issue_date":     invoice.IssueDate,
				"due_date":       invoice.DueDate,
				"status":         invoice.Status,
				"amount":         invoice.Amount,
				"tax":            invoice.Tax,
				"total":          invoice.Total,
				"due_amount":     invoice.DueAmount,
				"notes":          invoice.Notes,
				"subject":        invoice.Subject,
				"currency":       invoice.Currency,
				"biller_name":    invoice.BillerName,
				"biller_address": invoice.BillerAddress,
				"biller_email":   invoice.BillerEmail,
				"biller_phone":   invoice.BillerPhone,
				"client_name":    invoice.ClientName,
				"client_address": invoice.ClientAddress,
				"client_email":   invoice.ClientEmail,
				"client_phone":   invoice.ClientPhone,
				"harvest_id":     invoice.HarvestID,
				"paid_date":      invoice.PaidDate,
				"paid_at":        invoice.PaidAt,
				"sent_at":        invoice.SentAt,
				"closed_at":      invoice.ClosedAt,
				"updated_at":     time.Now(),
			}
			if err := database.DB.Model(&existing).Updates(updates).Error; err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Invoice %s: failed to update existing invoice", input.Number))
				result.Skipped++
				continue
			}
			if err := upsertHarvestInvoiceLines(existing.ID, invoice.IssueDate, invoice.ClientID, input.LineItems); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Invoice %s: failed to update invoice lines", input.Number))
				result.Skipped++
				continue
			}
			result.Updated++
			continue
		}
		if err != gorm.ErrRecordNotFound {
			result.Errors = append(result.Errors, fmt.Sprintf("Invoice %s: failed duplicate check", input.Number))
			result.Skipped++
			continue
		}

		if dryRun {
			result.Imported++
			result.InvoicesUpserted++
			continue
		}
		if err := database.DB.Create(&invoice).Error; err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Invoice %s: failed to create invoice", input.Number))
			result.Skipped++
			continue
		}
		if err := upsertHarvestInvoiceLines(invoice.ID, invoice.IssueDate, invoice.ClientID, input.LineItems); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Invoice %s: failed to create invoice lines", input.Number))
			result.Skipped++
			continue
		}
		result.Imported++
		result.InvoicesUpserted++
	}

	return result
}

func upsertHarvestInvoiceLines(invoiceID uint, issueDate time.Time, clientID uint, lineItems []harvestInvoiceLineItem) error {
	if len(lineItems) == 0 {
		return nil
	}

	lines := make([]InvoiceLineRequest, 0, len(lineItems))
	for index, item := range lineItems {
		projectName := strings.TrimSpace(item.Project.Name)
		projectID := findInvoiceLineProjectID(clientID, projectName)
		lineType := strings.TrimSpace(item.Kind)
		if lineType == "" {
			lineType = "service"
		}

		lines = append(lines, InvoiceLineRequest{
			ProjectID:   projectID,
			ServiceDate: &issueDate,
			ProjectName: projectName,
			Description: strings.TrimSpace(item.Description),
			Hours:       item.Quantity,
			Rate:        item.UnitPrice,
			Amount:      item.Amount,
			LineType:    strings.ToLower(lineType),
			SortOrder:   index,
		})
	}

	tx := database.DB.Begin()
	if _, _, err := replaceInvoiceLines(tx, invoiceID, lines); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit().Error
}

func findInvoiceLineProjectID(clientID uint, projectName string) *uint {
	if projectName == "" {
		return nil
	}

	var project models.Project
	if err := database.DB.Where("client_id = ? AND name = ?", clientID, projectName).First(&project).Error; err != nil {
		return nil
	}
	return &project.ID
}

func parseHarvestTime(record []string, index map[string]int) (time.Time, int, error) {
	durationSeconds := parseDurationSeconds(firstValue(record, index, "hours", "hoursrounded", "duration", "durationhours"))
	if durationSeconds <= 0 {
		return time.Time{}, 0, fmt.Errorf("hours or duration is required")
	}

	dateText := firstValue(record, index, "date", "spentdate", "entrydate")
	if dateText == "" {
		return time.Time{}, 0, fmt.Errorf("date is required")
	}

	date, err := parseHarvestDate(dateText)
	if err != nil {
		return time.Time{}, 0, err
	}

	startText := firstValue(record, index, "starttime", "from")
	if startText == "" {
		return time.Date(date.Year(), date.Month(), date.Day(), 12, 0, 0, 0, time.Local), durationSeconds, nil
	}

	clock, err := parseClock(startText)
	if err != nil {
		return time.Time{}, 0, err
	}

	return time.Date(date.Year(), date.Month(), date.Day(), clock.Hour(), clock.Minute(), 0, 0, time.Local), durationSeconds, nil
}

func parseHarvestDate(value string) (time.Time, error) {
	for _, layout := range []string{"2006-01-02", "01/02/2006", "1/2/2006", "Jan 2, 2006", "January 2, 2006"} {
		if parsed, err := time.ParseInLocation(layout, value, time.Local); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported date %q", value)
}

func parseOptionalDate(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	parsed, err := parseHarvestDate(value)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func mustParseOptionalDate(value *string) *time.Time {
	if value == nil {
		return nil
	}
	parsed, err := parseOptionalDate(*value)
	if err != nil {
		return nil
	}
	return parsed
}

func mustParseOptionalTimestamp(value *string) *time.Time {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05Z", "2006-01-02"} {
		if parsed, err := time.Parse(layout, strings.TrimSpace(*value)); err == nil {
			return &parsed
		}
	}
	return nil
}

func parseClock(value string) (time.Time, error) {
	for _, layout := range []string{"15:04", "3:04 PM", "3:04PM", "15:04:05"} {
		if parsed, err := time.ParseInLocation(layout, strings.TrimSpace(value), time.Local); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported start time %q", value)
}

func parseDurationSeconds(value string) int {
	value = strings.TrimSpace(strings.ReplaceAll(value, ",", ""))
	if value == "" {
		return 0
	}
	if strings.Contains(value, ":") {
		parts := strings.Split(value, ":")
		if len(parts) >= 2 {
			hours, _ := strconv.Atoi(parts[0])
			minutes, _ := strconv.Atoi(parts[1])
			return hours*3600 + minutes*60
		}
	}
	hours, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0
	}
	return int(math.Round(hours * 3600))
}

func parseMoney(value string) float64 {
	clean := strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(value, "$", ""), ",", ""))
	amount, _ := strconv.ParseFloat(clean, 64)
	return amount
}

func parseBillable(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "yes", "y", "true", "1", "billable":
		return true
	default:
		return false
	}
}

func normalizeInvoiceStatus(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "paid", "closed":
		return "paid"
	case "open", "sent":
		return "open"
	case "draft":
		return "draft"
	default:
		if strings.TrimSpace(value) == "" {
			return "draft"
		}
		return strings.ToLower(strings.TrimSpace(value))
	}
}

func defaultString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func firstValue(record []string, index map[string]int, names ...string) string {
	for _, name := range names {
		if i, ok := index[normalizeHeader(name)]; ok && i < len(record) {
			if value := strings.TrimSpace(record[i]); value != "" {
				return value
			}
		}
	}
	return ""
}

func normalizeHeader(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	replacer := strings.NewReplacer(" ", "", "_", "", "-", "", "?", "", "/", "", ".", "")
	return replacer.Replace(value)
}
