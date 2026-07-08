# R.A.V. School Result Portal

A secure, web-based admin portal for managing and generating student result sheets.

## Features

- **Secure Access:** Admin authentication with cookie-based session verification.
- **Data Integration:** Processes structured student data to compile academic results.
- **Document Generation:** Exports formatted academic report cards as downloadable PDF documents.
- **Validation Engine:** Automatically checks input records for formatting consistency.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env.local`:
   ```env
   ADMIN_USERNAME=your_username
   ADMIN_PASSWORD=your_password
   JWT_SECRET=your_secret_key
   ```

### Running the Application

* **Development Mode:**
  ```bash
  npm run dev
  ```

* **Production Mode:**
  ```bash
  npm run build
  npm run start
  ```
