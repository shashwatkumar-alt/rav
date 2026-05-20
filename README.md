# RAV School Result Generator

A web application for **Ramkrishna Anglo Vedic Public School** to generate student result card PDFs from Excel workbooks.

## Features

- **Admin Login** — Secured with fixed credentials via JWT tokens
- **Excel Upload** — Parses multi-sheet workbooks with multi-row merged headers
- **Result Types** — Supports both **SA-I (Term I)** and **SA-II (Term II / Final)** results
- **Dynamic Subjects** — Auto-detects subjects per class from Excel headers
- **PDF Generation** — Produces formatted result cards matching the school template
- **Co-Scholastic & Discipline** — Grades parsed from Excel sections
- **Attendance & SUPW** — Populated from Excel data per term

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript**
- **jsPDF** — Client-side PDF generation
- **xlsx (SheetJS)** — Excel workbook parsing
- **jose** — JWT authentication

## Project Structure

```
src/
├── app/
│   ├── api/auth/        # Login / Logout / Check API routes
│   ├── dashboard/       # Main dashboard page (upload + generate)
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Login page
├── lib/
│   ├── auth.ts           # JWT token utilities
│   ├── excel-parser.ts   # Excel workbook → structured data
│   ├── grading.ts        # Grading scale logic
│   ├── pdf-generator.ts  # Structured data → PDF result cards
│   └── types.ts          # TypeScript type definitions
├── middleware.ts          # Auth middleware (protects /dashboard)
public/
├── logo1.png             # Principal's signature image
└── logo2.jpg             # School logo
```

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to log in and generate results.

## Environment Variables

Create a `.env.local` with:

```
ADMIN_USERNAME=<username>
ADMIN_PASSWORD=<password>
JWT_SECRET=<secret-key>
```
