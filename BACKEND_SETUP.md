# Express Backend Setup Guide

Your admin panel now uses a simple Express backend for creating admins. This is easier to test and deploy than Cloud Functions.

## Local Development Setup

### 1. Get Firebase Service Account Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/project/ai-studio-applet-webapp-a5612/settings/serviceaccounts/adminsdk)
2. Click "Generate New Private Key"
3. A JSON file will download - keep this safe!

### 2. Set Up Environment Variables

1. Create `backend/.env.local` with your Firebase credentials:
```
FIREBASE_PROJECT_ID=ai-studio-applet-webapp-a5612
FIREBASE_PRIVATE_KEY_ID=your_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@ai-studio-applet-webapp-a5612.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789
FIREBASE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...
FIREBASE_DATABASE_URL=https://ai-studio-applet-webapp-a5612.firebaseio.com
PORT=3001
```

2. Create `.env.local` in root directory:
```
VITE_BACKEND_URL=http://localhost:3001
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

### 4. Run Both Frontend and Backend

**Terminal 1 - Start Backend:**
```bash
cd backend
npm start
```

You should see:
```
✓ Backend server running on port 3001
  Health check: http://localhost:3001/api/health
  Create admin: POST http://localhost:3001/api/create-admin
```

**Terminal 2 - Start Frontend:**
```bash
npm run dev
```

### 5. Test Create Admin

1. Log in with your admin account
2. Go to "Create Admins" → "Create Admin Account"
3. Enter email and name
4. Click "Create Admin Account"

If successful, the new admin is created immediately!

---

## Deploy to Vercel

### Option 1: Frontend & Backend on Same Vercel Project

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Set Environment Variables in Vercel:**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add these secrets:
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_PRIVATE_KEY_ID`
     - `FIREBASE_PRIVATE_KEY`
     - `FIREBASE_CLIENT_EMAIL`
     - `FIREBASE_CLIENT_ID`
     - `FIREBASE_CLIENT_X509_CERT_URL`
     - `FIREBASE_DATABASE_URL`

3. **Deploy:**
   ```bash
   vercel deploy --prod
   ```

4. **Update Frontend URL:**
   - After deployment, Vercel shows your URL (e.g., `https://your-project.vercel.app`)
   - Add environment variable in Vercel for frontend:
     - `VITE_BACKEND_URL=https://your-project.vercel.app`

### Option 2: Separate Backend Deployment

Deploy backend to a different service:

**Railway.app (Easy):**
1. Push code to GitHub
2. Connect Railway to GitHub
3. Deploy the `backend` folder
4. Get the backend URL from Railway
5. Add to Vercel environment: `VITE_BACKEND_URL=https://railway-backend-url.railway.app`

**Heroku (Legacy, limited free tier):**
```bash
cd backend
heroku create your-app-name
git push heroku main
```

---

## Project Structure

```
admin/
├── backend/                    # Express backend
│   ├── api/
│   │   └── index.js           # Main server with /api/create-admin endpoint
│   ├── package.json
│   ├── .env.example           # Environment template
│   └── .env.local             # Your Firebase credentials (don't commit)
├── src/
│   ├── pages/
│   │   └── CreateAdmin.tsx    # Calls backend API
│   └── ...
├── .env.local                 # VITE_BACKEND_URL
├── vercel.json                # Vercel config for deploying both frontend & backend
└── ...
```

---

## API Overview

### POST `/api/create-admin`

**Headers:**
```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

**Body:**
```json
{
  "email": "admin@example.com",
  "password": "securepassword123",
  "displayName": "Admin Name"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Admin user admin@example.com created successfully",
  "uid": "firebase-uid"
}
```

**Error Response (400/403/500):**
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## Security Notes

✓ Verifies Firebase ID token  
✓ Checks if requester has `role: 'admin'`  
✓ Validates email and password  
✓ Stores admin creation logs (`createdBy`)  

---

## Troubleshooting

**"Backend not responding"**
- Make sure backend is running on port 3001
- Check `npm start` output for errors

**"Invalid Firebase credentials"**
- Verify all environment variables are set correctly
- Check that `FIREBASE_PRIVATE_KEY` has newlines: `replace(/\\n/g, '\n')`

**"Only admins can create other admins"**
- Verify you're logged in as an admin
- Check `users` collection for your user document

**CORS errors**
- Backend has CORS enabled by default
- If still having issues, update `vercel.json`

