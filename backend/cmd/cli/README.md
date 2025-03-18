# TimeVault CLI

A command-line interface for managing TimeVault users, including adding users and resetting passwords.

## Installation

The CLI is part of the TimeVault backend. To build it:

```bash
cd backend
go build -o timevault-cli cmd/cli/main.go
```

This will create an executable file called `timevault-cli` in the current directory.

## Usage

The CLI requires access to the same database as the TimeVault backend. Make sure your `.env` file is properly configured with the database connection details.

### Available Commands

#### List Users

List all users in the system:

```bash
./timevault-cli list-users
```

#### Add User

Add a new user to the system:

```bash
./timevault-cli add-user --name "User Name" --email "user@example.com" --password "userpassword" --role "user" --two-factor=false
```

Parameters:
- `--name` or `-n`: User's name (required)
- `--email` or `-e`: User's email (required)
- `--password` or `-p`: User's password (required)
- `--role` or `-r`: User's role (default: "user")
- `--two-factor` or `-t`: Enable two-factor authentication (default: false)

#### Reset Password

Reset a user's password without needing the original password:

```bash
./timevault-cli reset-password --email "user@example.com" --new-password "newpassword"
```

Parameters:
- `--email` or `-e`: User's email (required)
- `--new-password` or `-p`: New password (required)

#### Get User Details

Get details for a specific user:

```bash
./timevault-cli get-user --email "user@example.com"
```

Parameters:
- `--email` or `-e`: User's email (required)

#### Delete User

Delete a user from the system:

```bash
./timevault-cli delete-user --email "user@example.com"
```

Parameters:
- `--email` or `-e`: User's email (required)

The command will ask for confirmation before deleting the user.

## Examples

### Add an Admin User

```bash
./timevault-cli add-user --name "Admin User" --email "admin@example.com" --password "adminpassword" --role "admin"
```

### Reset a User's Password

```bash
./timevault-cli reset-password --email "user@example.com" --new-password "newstrongpassword"
```

### List All Users

```bash
./timevault-cli list-users
```

### Get User Details

```bash
./timevault-cli get-user --email "user@example.com"
```

### Delete a User

```bash
./timevault-cli delete-user --email "user@example.com"
```