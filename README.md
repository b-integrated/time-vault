# TimeVault

TimeVault is a comprehensive time tracking and invoicing application designed for freelancers and small businesses. It allows users to track time spent on projects, manage clients, generate invoices, and view detailed reports.

## Features

- **Time Tracking**: Track time spent on projects with start/stop functionality
- **Client Management**: Organize projects by client
- **Project Management**: Create and manage projects with detailed information
- **Invoicing**: Generate invoices based on tracked time
- **Reporting**: View detailed reports on time spent and earnings
- **Chrome Extension**: Track time directly from your browser
- **Offline Support**: Continue tracking time even when offline
- **Two-Factor Authentication**: Secure your account with 2FA

## Architecture

TimeVault consists of three main components:

1. **Backend API** (Go)
   - RESTful API built with Go
   - PostgreSQL database for data storage
   - JWT authentication with two-factor authentication

2. **Frontend Web Application** (React)
   - Single-page application built with React
   - Bootstrap for responsive design
   - Components for different features (dashboard, time tracker, clients, etc.)

3. **Chrome Extension**
   - Browser-based time tracking
   - Offline support with background syncing
   - Integrates with the backend API

## Prerequisites

- Go 1.18 or higher
- PostgreSQL 13 or higher
- Node.js 16 or higher (for running the frontend locally)
- Chrome browser (for the extension)

## Setup Instructions

### 1. Backend Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/timevault.git
   cd timevault
   ```

2. Set up PostgreSQL database:
   ```
   createdb timevault
   ```

3. Configure environment variables:
   - Copy the `.env.example` file to `.env` in the backend directory
   - Update the values in the `.env` file with your configuration:
     ```
     # Server Configuration
     PORT=8080
     ENV=development

     # Database Configuration
     DB_HOST=localhost
     DB_PORT=5432
     DB_USER=postgres
     DB_PASSWORD=your_password
     DB_NAME=timevault
     DB_SSL_MODE=disable

     # JWT Configuration
     JWT_SECRET=your_secret_key_change_in_production
     JWT_EXPIRATION=24h

     # Email Configuration (for 2FA)
     SMTP_HOST=smtp.example.com
     SMTP_PORT=587
     SMTP_USER=your-email@example.com
     SMTP_PASSWORD=your-email-password
     SMTP_FROM=noreply@timevault.com
     ```

4. Install Go dependencies and run the backend:
   ```
   cd backend
   go mod download
   go run cmd/main.go
   ```

5. The backend API will be available at `http://localhost:8080`

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Serve the frontend using a local web server:
   - You can use any web server of your choice, such as:
     - Python's built-in HTTP server: `python -m http.server`
     - Node.js http-server: `npx http-server`
     - PHP's built-in server: `php -S localhost:3000`

3. Access the frontend at `http://localhost:3000` (or whatever port your web server uses)

### 3. Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`

2. Enable "Developer mode" by toggling the switch in the top-right corner

3. Click "Load unpacked" and select the `chrome-extension` directory from the project

4. The TimeVault extension icon should appear in your browser toolbar

## Starting All Services

To run the complete TimeVault application:

1. Start the backend server:
   ```
   cd backend
   go run cmd/main.go
   ```

2. Serve the frontend:
   ```
   cd frontend
   # Using Python's HTTP server as an example
   python -m http.server 3000
   ```

3. Load the Chrome extension as described above

## First-Time Setup

### Accessing the Setup Page

When you first install and run TimeVault, you need to create an initial administrator account. To access the first-time setup:

1. Ensure both the backend server and frontend web server are running as described in the "Starting All Services" section.
2. Open your web browser and navigate to `http://localhost:3000` (or whatever port your frontend web server uses).
3. The system will automatically detect that no users exist in the database and will display the first-time setup screen.

> **Important**: This first-time setup screen only appears when the database has no existing users. Once an admin user is created, this screen will no longer be accessible.

### Creating the Initial Admin User

On the first-time setup screen:

1. You'll see a form to create your admin account with the following fields:
   - **Name**: Enter your full name
   - **Email**: Enter a valid email address (this will be your login username)
   - **Password**: Create a strong password
   - **Confirm Password**: Re-enter the same password to verify

2. Click the "Create Admin User" button to submit the form.

3. The system will:
   - Create your admin account in the database
   - Generate a JWT authentication token
   - Log you in automatically
   - Redirect you to the dashboard

This initial admin user has full system privileges, including:
- Creating and managing other user accounts
- Accessing all system features and settings
- Configuring application-wide preferences
- Managing all clients, projects, and invoices

> **Technical Note**: Behind the scenes, the frontend makes a POST request to `http://localhost:8080/api/auth/setup` to create the admin user. The backend verifies that no users exist before allowing this operation to succeed.

## Usage

1. **Registration and Login**:
   - Access the frontend application
   - Register a new account
   - Set up two-factor authentication if desired
   - Log in with your credentials

2. **Client and Project Setup**:
   - Create clients from the Clients page
   - Add projects for each client from the Projects page

3. **Time Tracking**:
   - Use the Time Tracker page in the web application
   - Or use the Chrome extension for convenient tracking
   - Select a project, add a description, and start the timer
   - Stop the timer when you're done

4. **Invoicing**:
   - Go to the Invoices page
   - Create a new invoice for a client
   - Select the time entries to include
   - Generate and download the invoice

5. **Reporting**:
   - View reports on the Reports page
   - Filter by date range, client, or project
   - Analyze your time and earnings

## Development

### Backend Development

- The backend is structured using a standard Go project layout
- Main components:
  - `cmd/main.go`: Entry point
  - `internal/handlers`: API endpoint handlers
  - `internal/models`: Data models
  - `internal/database`: Database connection and migrations
  - `internal/auth`: Authentication logic

### Frontend Development

- The frontend uses React with JSX
- Components are organized in the `js/components` directory
- Main components:
  - `Auth.js`: Login and registration
  - `Dashboard.js`: Overview dashboard
  - `TimeTracker.js`: Time tracking interface
  - `Projects.js`: Project management
  - `Clients.js`: Client management
  - `Invoices.js`: Invoice generation
  - `Reports.js`: Reporting interface
  - `Settings.js`: User settings

### Chrome Extension Development

- The extension is located in the `chrome-extension` directory
- Main components:
  - `manifest.json`: Extension configuration
  - `src/popup.html`, `src/popup.js`, `src/popup.css`: Popup interface
  - `src/background.js`: Background service worker
  - `src/content.js`: Content script for page integration

## License

[MIT License](LICENSE)

## Contact

For questions or support, please contact [your-email@example.com](mailto:your-email@example.com)