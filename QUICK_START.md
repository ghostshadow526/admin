# Quick Start - Express Backend

## For Testing (Local Machine)

### Step 1: Get Firebase Credentials

1. Go to: https://console.firebase.google.com/project/ai-studio-applet-webapp-a5612/settings/serviceaccounts/adminsdk
2. Click "Generate New Private Key"
3. Save the JSON file safely

### Step 2: Set Up Environment Variable

In `backend/.env.local`, copy the values from your JSON file:

```
FIREBASE_PROJECT_ID=ai-studio-applet-webapp-a5612
FIREBASE_PRIVATE_KEY_ID=<from json key>
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n<content from json key, keep \n>\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=<from json key>
FIREBASE_CLIENT_ID=<from json key>
FIREBASE_CLIENT_X509_CERT_URL=<from json key>
FIREBASE_DATABASE_URL=https://ai-studio-applet-webapp-a5612.firebaseio.com
PORT=3001
```

### Step 3: Start Backend

```bash
cd backend
npm install
npm start
```

### Step 4: Start Frontend (different terminal)

```bash
npm run dev
```

### Step 5: Test It

1. Go to http://localhost:3001
2. Log in as admin
3. Go to "Create Admins" → Create a new admin
4. Done! ✓

---

## For Vercel Deployment

1. Set the 7 Firebase environment variables in Vercel Project Settings
2. Deploy: `vercel deploy --prod`
3. Set environment variable in Vercel:
   - `VITE_BACKEND_URL=https://your-vercel-url.vercel.app`

See [BACKEND_SETUP.md](BACKEND_SETUP.md) for detailed instructions.
