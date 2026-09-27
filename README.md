# Mahacrop Loan

Marathi-language farmer loan website with a React/Vite frontend and an Express/MongoDB API.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB running locally or a MongoDB Atlas connection string

## Run locally

1. In `backend`, copy `.env.example` to `.env` and set `MONGO_URI` and a long random `SESSION_SECRET`.
2. Set a private `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and separate `ADMIN_RESET_KEY`. On first API startup an admin account is created if that username does not exist. With the unmodified development defaults, sign in at `/admin` with username `admin` and password `ChangeMeAdmin123!`; change these before sharing or deploying the app. The admin panel's no-OTP password reset requires the recovery key.
3. User password reset does not use OTP or SMS. Each user sets a private recovery phrase during registration and uses it with their mobile number to choose a new password. Existing users can set or replace the phrase from the account menu after confirming their current password. Keep this phrase private and memorable.
4. Install backend packages and start the API:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

5. In a second terminal, install frontend packages and start Vite:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

6. Open the local URL printed by Vite, normally `http://localhost:5173`.

The Vite development server proxies `/api` requests to the API at `http://localhost:5000`. Set `VITE_API_URL` in the frontend environment when using a different API origin.

## Deploy on Render without a custom domain

The frontend and API must share one origin for mobile browsers to reliably retain the session cookie. Deploy this repository as a single Render **Web Service** (not as a separate Static Site and API service). The GitHub repository connected to Render must contain both the `frontend/` and `backend/` directories.

- Root Directory: leave blank (repository root)
- Build Command: `cd frontend && npm ci --include=dev && npm run build && cd ../backend && npm ci --omit=dev`
- Start Command: `cd backend && npm start`
- Environment: set `MONGO_URI`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_RESET_KEY`, and `NODE_ENV=production`

Do not set `VITE_API_URL`; the frontend then calls `/api` on the same Render hostname. The backend serves `frontend/dist` and returns the React app for routes such as `/admin`, `/crop-loan`, and `/notification`. It defaults CORS to Render's own service hostname; if setting `FRONTEND_ORIGIN` manually, use that exact HTTPS URL without a trailing slash.

If the frontend and backend remain separate services, configuring SPA rewrites can fix direct-route 404s, but it does not solve mobile browsers blocking cross-site session cookies.

Users create an account with a mobile number and password, then log in through the account menu. Sessions use HTTP-only cookies and expire after seven days without activity; active interactions refresh the session. Loan applications require an authenticated session and save applicant details and their five required documents in MongoDB. Document content is stored in the `loanDocuments` GridFS bucket, so it survives Render redeploys and works across multiple API instances. Each file is limited to 10 MB (JPG, PNG, WEBP, or PDF), and document access remains behind admin authentication.

Before deploying this storage change, migrate any existing files that are still in `backend/private-uploads` while running locally with access to the same MongoDB database:

```powershell
cd backend
npm run migrate:uploads
```

The migration updates application document references to GridFS and leaves the original local files untouched. Review its output and confirm the referenced files are available before deploying; files missing from the local folder cannot be migrated by this script.

Admins can review every application at `/admin`, open its private documents, and approve or reject it with a required rejection reason. Each review creates or updates a user notification; opening `/notification` marks notifications as read.

User password reset requires the account's private recovery phrase; the phrase is stored as a bcrypt hash and active sessions are invalidated after a successful reset. Admin password reset uses the separate `ADMIN_RESET_KEY`. Neither reset flow sends OTPs.