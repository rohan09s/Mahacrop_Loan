# Mahacrop Loan

Marathi-language farmer loan website with a React/Vite frontend and an Express/MongoDB API.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB running locally or a MongoDB Atlas connection string

## Run locally

1. In `backend`, copy `.env.example` to `.env` and set `MONGO_URI` and a long random `SESSION_SECRET`.
2. Set a private `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and separate `ADMIN_RESET_KEY`. On first API startup an admin account is created if that username does not exist. With the unmodified development defaults, sign in at `/admin` with username `admin` and password `ChangeMeAdmin123!`; change these before sharing or deploying the app. The admin panel's no-OTP password reset requires the recovery key.
3. Add your 2Factor API key as `TWO_FACTOR_API_KEY` in `backend/.env` and in Render's backend environment settings. New users register after SMS OTP verification and create a password; users can then log in with either their mobile number and password or an SMS OTP. Existing OTP-only users can create a password after verifying an OTP. Keep this key private and server-side.
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

## Frontend structure

The frontend code is grouped by responsibility so pages and shared UI can be changed independently:

```text
frontend/src/
├── components/       # Shared forms and loan-detail UI
├── config/           # API configuration
├── data/             # Loan options and application field definitions
├── pages/            # Admin portal and applicant application list
├── App.jsx           # Routing, session state, and site shell
├── App.css           # Existing site-wide component styles
└── index.css         # Base styles
```

The loan application form uses the bundled Maharashtra district, taluka, and village list in `frontend/public/maharashtra-locations.json`, adapted from the [Bharat Location Hub](https://github.com/Recentlystarted/bharat-location-hub) dataset. The data file records its source revision and includes the Palghar district split; four urban talukas that have no village entries in the source use their urban locality as the only village choice. Place names display in Devanagari while their English canonical values are submitted; district spellings are localized and other names use approximate phonetic transliteration, not verified official Marathi spellings. Survey number is currently the placeholder `Hardcoded Survey Number`.

The loan application currently offers the crop-loan option and uses a five-page wizard. Page 1 collects Aadhaar/PAN details, shows sample cards from `frontend/src/assets/` in a foreground preview, and reveals the configured bank details after the Aadhaar sample is opened. Page 1 advances only when both card numbers are valid and the names match. Page 2 provides a hardcoded CIBIL score of 750, occupancy classification, and survey-number fields with foreground previews for Satbara, 8-A, and mutation documents; the two occupancy-class answers are complementary, and class 2 ownership prevents continuing. Page 3 collects the crop survey number, area, and crop and estimates the eligible amount at ₹59,400 per hectare. Page 4 presents application terms and conditions; acceptance is required to continue. Page 5 calculates stamp duty at 0.3% of the eligible amount when that amount is ₹2,00,000 or more, and supports online payment through Razorpay; no stamp duty is due below that threshold. A verified payment automatically submits the application; when no fee is due, the applicant can submit directly. The backend validates fee eligibility and payment status, stores the application and masked Aadhaar/PAN suffixes, and creates a submission notification. Successful submission redirects to the home page.

When a wizard application is submitted, its Aadhaar, PAN, 7/12, 8-A, and mutation sample PDFs from `frontend/src/assets/` are uploaded to the private GridFS document store and linked to that application. Admins can open these PDFs inline from the application panel; access requires admin authentication. These are the site-provided sample PDFs, not personal documents supplied by the applicant.

Admins process each application through four ordered workflow stages: receive/open, begin application and document verification, complete verification, and either send the application forward or return it with a required reason. Every stage transition creates a separate user notification. Existing applications and notifications are migrated to the closest matching workflow stage at backend startup.

To enable stamp-duty payments, set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `backend/.env` and in the backend deployment environment. Use Razorpay test-mode credentials while testing. The key secret stays server-side; only the key ID is returned to the checkout UI. Razorpay Checkout offers the payment methods enabled for the merchant account; availability depends on the merchant configuration. Without these credentials, the page still displays the calculated fee but the API will reject payment-order creation with a configuration error.

## Backend structure

The Express API is split by responsibility while keeping the existing endpoints and startup flow:

```text
backend/
├── config/          # Shared paths, limits, and application-number generation
├── middleware/      # Authentication, security, uploads, and error handling
├── routes/          # Health, authentication, applications, and notifications
├── services/        # GridFS document storage
├── utils/           # Shared user serialization
├── app.js           # Express middleware, routes, and frontend serving
└── server.js        # Environment setup, database initialization, and listener
```

## Deploy on Render without a custom domain

The frontend and API must share one origin for mobile browsers to reliably retain the session cookie. Deploy this repository as a single Render **Web Service** (not as a separate Static Site and API service). The GitHub repository connected to Render must contain both the `frontend/` and `backend/` directories.

- Root Directory: leave blank (repository root)
- Build Command: `cd frontend && npm ci --include=dev && npm run build && cd ../backend && npm ci --omit=dev`
- Start Command: `cd backend && npm start`
- Environment: set `MONGO_URI`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_RESET_KEY`, `TWO_FACTOR_API_KEY`, and `NODE_ENV=production`. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to enable stamp-duty payments.

Do not set `VITE_API_URL`; the frontend then calls `/api` on the same Render hostname. The backend serves `frontend/dist` and returns the React app for routes such as `/admin`, `/crop-loan`, and `/notification`. It defaults CORS to Render's own service hostname; if setting `FRONTEND_ORIGIN` manually, use that exact HTTPS URL without a trailing slash.

If the frontend and backend remain separate services, configuring SPA rewrites can fix direct-route 404s, but it does not solve mobile browsers blocking cross-site session cookies.

Users can log in with their mobile number and password or verify their mobile number with a 2Factor SMS OTP. New users complete their name and address profile and create a password after OTP verification; existing OTP-only users can continue with OTP or set a password after verification. Users who forget their password can verify their registered mobile by OTP and set a new password. Passwords are hashed before storage. User sessions use HTTP-only cookies and expire after 14 days without activity; active interactions refresh the session. Logging out destroys the session immediately. Loan applications require an authenticated session. The wizard submission stores the entered application details, only the last four Aadhaar/PAN characters, and its sample PDF files. The document-upload endpoints store document content in the `loanDocuments` GridFS bucket, so files survive Render redeploys and work across multiple API instances. Each file is limited to 10 MB (JPG, PNG, WEBP, or PDF), and document access remains behind admin authentication.

Before deploying this storage change, migrate any existing files that are still in `backend/private-uploads` while running locally with access to the same MongoDB database:

```powershell
cd backend
npm run migrate:uploads
```

The migration updates application document references to GridFS and leaves the original local files untouched. Review its output and confirm the referenced files are available before deploying; files missing from the local folder cannot be migrated by this script.

Admins can review every application at `/admin`, open its private documents, and advance it through the four-stage review process. Sending an application back requires a reason. Each stage transition creates a separate user notification; opening `/notification` marks notifications as read.

User authentication uses OTP verification; admin authentication remains username/password-based. Admin password reset uses the separate `ADMIN_RESET_KEY`.