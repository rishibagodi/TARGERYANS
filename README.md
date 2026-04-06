# LoanLens

LoanLens is a full-stack web app for loan planning, monthly commitment tracking, savings visibility, and prepayment simulation.

## Repository Format

```text
project-name/
│
├── README.md              <- Project explanation
├── presentation.pptx      <- Hackathon PPT
│
└── project/               <- Actual implementation
		├── emi-frontend/
		└── emi-backend/
```

## Modules and Dependencies

### Frontend (`project/emi-frontend`)

- Runtime:
	- `react`
	- `react-dom`
- Dev/build:
	- `vite`
	- `@vitejs/plugin-react`
	- `tailwindcss`
	- `postcss`
	- `autoprefixer`
	- `eslint` and related plugins

### Backend (`project/emi-backend`)

- Runtime:
	- `express`
	- `cors`
	- `dotenv`
	- `@anthropic-ai/sdk` (optional AI advice)

## Prerequisites

- Node.js 18+
- npm

## Installation

### 1. Install frontend dependencies

```powershell
cd "d:\DEV CRAFT\TARGERYANS\project\emi-frontend"
npm install
```

### 2. Install backend dependencies

```powershell
cd "d:\DEV CRAFT\TARGERYANS\project\emi-backend"
npm install
```

## Environment Variables (Backend)

Create `.env` in `project/emi-backend`:

```env
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
CLAUDE_API_KEY=
```

Notes:
- `CLAUDE_API_KEY` is optional.
- If key is not set, fallback advice generation is used.

## How to Run the Application

Use two terminals.

### Terminal 1: Start backend

```powershell
cd "d:\DEV CRAFT\TARGERYANS\project\emi-backend"
npm run dev
```

### Terminal 2: Start frontend

```powershell
cd "d:\DEV CRAFT\TARGERYANS\project\emi-frontend"
npm run dev
```

Frontend URL:
- `http://localhost:5173`

## Build Commands

### Frontend production build

```powershell
cd "d:\DEV CRAFT\TARGERYANS\project\emi-frontend"
npm run build
```

### Backend production start

```powershell
cd "d:\DEV CRAFT\TARGERYANS\project\emi-backend"
npm start
```

## API Endpoints

- `GET /api/health`
- `POST /api/analyze`
- `POST /api/advice`

## Features

- Loan schedule using total amount + tenure (months)
- Automatic monthly commitment calculation
- Risk analysis and insights
- Savings dashboard with post-saving balance
- Month-wise savings ledger (local storage)
- Prepayment planner with payoff timeline and months saved
