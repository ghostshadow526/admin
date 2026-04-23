# Firebase Cloud Functions Deployment Guide

## Quick Manual Deployment (Recommended)

### Option 1: Deploy Using Firebase Console (Easiest)

1. **Go to Firebase Console:**
   - Open https://console.firebase.google.com/project/ai-studio-applet-webapp-a5612/functions

2. **Create a New Function:**
   - Click "Create Function"
   - Set the following:
     - **Name:** `createAdminUser`
     - **Trigger:** HTTPS
     - **Authentication:** Require authentication
     - **Runtime:** Node.js 20

3. **Copy and Paste the Function Code:**

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors');

admin.initializeApp();

const corsHandler = cors({ origin: true });

exports.createAdminUser = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      // Check if user is authenticated
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: No token provided',
        });
        return;
      }

      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      const uid = decodedToken.uid;

      // Verify requester is an admin
      const requesterDoc = await admin
        .firestore()
        .collection('users')
        .doc(uid)
        .get();

      if (!requesterDoc.exists || requesterDoc.data()?.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Only admins can create other admins',
        });
        return;
      }

      // Validate request body
      const { email, password, displayName } = req.body;

      if (!email || !password || !displayName) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: email, password, displayName',
        });
        return;
      }

      // Validate password strength (at least 6 characters)
      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters',
        });
        return;
      }

      // Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });

      // Create user document in Firestore with admin role
      await admin
        .firestore()
        .collection('users')
        .doc(userRecord.uid)
        .set({
          email,
          displayName,
          uid: userRecord.uid,
          role: 'admin',
          isUpgraded: true,
          createdAt: admin.firestore.Timestamp.now(),
          createdBy: requesterDoc.data()?.email || uid,
        });

      res.status(201).json({
        success: true,
        message: `Admin user ${email} created successfully`,
        uid: userRecord.uid,
      });
    } catch (error) {
      console.error('Error creating admin user:', error);

      // Handle Firebase-specific errors
      if (error.code === 'auth/email-already-exists') {
        res.status(400).json({
          success: false,
          message: 'Email already in use',
        });
        return;
      }

      if (error.code === 'auth/invalid-email') {
        res.status(400).json({
          success: false,
          message: 'Invalid email address',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: `Error creating admin user: ${error.message}`,
      });
    }
  });
});
```

4. **Deploy:**
   - Click "Deploy"
   - Wait for the function to deploy (usually 1-2 minutes)

5. **Copy Your Function URL:**
   - Once deployed, copy the URL from the function details
   - Should look like: `https://us-central1-ai-studio-applet-webapp-a5612.cloudfunctions.net/createAdminUser`

6. **Update Your Frontend** (if URL is different):
   - Open `src/pages/CreateAdmin.tsx`
   - Update the fetch URL to match your function URL

---

### Option 2: Deploy Using Firebase CLI (Local Machine)

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase:**
   ```bash
   firebase login
   ```

3. **From the project root (`c:\Users\Khaleedy\Downloads\admin`):**
   ```bash
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```

---

## Verify Deployment

1. Go to https://console.firebase.google.com/project/ai-studio-applet-webapp-a5612/functions
2. You should see `createAdminUser` function listed
3. The status should be "OK" (green checkmark)

## Test the Function

1. Open your admin panel
2. Log in as an admin
3. Go to "Create Admins" → "Create Admin Account" tab
4. Enter an email and display name
5. Click "Create Admin Account"

If successful, you should see: "Admin [email] created successfully!"

---

## Troubleshooting

**Error: "Function URL is not correct"**
- Copy the actual function URL from Firebase Console
- Update `src/pages/CreateAdmin.tsx` line ~45

**Error: "Only admins can create other admins"**
- Make sure you're logged in as an admin
- Check that your user document has `role: 'admin'` in Firestore

**Error: "Email already in use"**
- The email is already registered in Firebase Auth
- Try a different email address

**Error: "CORS error"**
- The function might not have CORS enabled yet
- Redeploy the function to ensure CORS headers are set correctly

---

## Security Notes

- The function requires authentication (Bearer token)
- Only users with `role: 'admin'` can create other admins
- Passwords must be at least 6 characters
- Email validation is performed
- All admin creations are logged with `createdBy` field

