# Firebase Cloud Functions Setup Guide

This guide will help you deploy the Cloud Functions used by the admin panel.

## Prerequisites

1. **Firebase CLI** installed:
   ```bash
   npm install -g firebase-tools
   ```

2. **Node.js** (version 20 or higher)

3. **Google Cloud Platform Account** with billing enabled

## Deployment Steps

### 0) Install + authenticate Firebase CLI

This repo includes `firebase-tools` as a dev dependency, so you can use `npx`:

```bash
npx firebase login
```

Then set the project (this projectId matches your frontend config):

```bash
npx firebase use --add ai-studio-applet-webapp-a5612
```

### 1. Initialize Firebase (if not already done)

```bash
firebase login
firebase init functions
```

### 2. Install Dependencies

```bash
cd functions
npm install
```

### 3. Configure Your Firebase Project

Make sure your `firebase.json` file has the correct project ID:

```json
{
  "projects": {
    "default": "ai-studio-applet-webapp-a5612"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-functions-log.log"]
    }
  ]
}
```

### 4. Deploy the Function

From the root directory (not inside `/functions`):

```bash
npx firebase deploy --only functions --project ai-studio-applet-webapp-a5612
```

This will deploy the functions (including `createAdminUser` and `imagekitAuth`) to Firebase Cloud Functions.

## Gallery (ImageKit) configuration

The Gallery page uploads images to ImageKit and saves only the resulting image URL in Firestore.

Important: the ImageKit **private key must never be placed in the frontend**. It is only used inside the Cloud Function `imagekitAuth`.

### Required server env vars

Configure these for the Cloud Functions runtime:

- `IMAGEKIT_PUBLIC_KEY`
- `IMAGEKIT_PRIVATE_KEY`

Alternatively (recommended for deployed functions), set Firebase Functions config keys:

```bash
npx firebase functions:config:set \
  imagekit.public_key="..." \
  imagekit.private_key="..." \
  --project ai-studio-applet-webapp-a5612
```

### Local development (emulator)

Create a file at `functions/.env`:

```bash
IMAGEKIT_PUBLIC_KEY=...your_public_key...
IMAGEKIT_PRIVATE_KEY=...your_private_key...
```

Then run:

```bash
firebase emulators:start --only functions
```

### Deployed functions

Set the same environment variables/secrets in your deployed Functions environment (how you do this depends on your Firebase Functions generation and deployment setup).

After deploying, verify the function exists:

```bash
npx firebase functions:list --project ai-studio-applet-webapp-a5612
```

If `imagekitAuth` is not listed, the URL `https://us-central1-ai-studio-applet-webapp-a5612.cloudfunctions.net/imagekitAuth` will return `404` and your browser will show a CORS error.

## Firestore rules (required for Gallery)

The Gallery page reads/writes the `gallery` collection. If your Firestore rules don’t allow it, you’ll see:

`FirebaseError: Missing or insufficient permissions`

This repo includes a rules file at `firestore.rules` that allows **admins** to read/write `gallery`.

Deploy rules:

```bash
npx firebase deploy --only firestore:rules --project ai-studio-applet-webapp-a5612
```

After the keys are set, the frontend can call the callable function `imagekitAuth` automatically via the Firebase SDK (no manual URL wiring).

### 5. Get Your Function URL

After deployment, you'll see output like:

```
Function URL (createAdminUser(us-central1)): https://us-central1-ai-studio-applet-webapp-a5612.cloudfunctions.net/createAdminUser
```

### 6. Update the Frontend

The function URL is already configured in the code as:
```
https://us-central1-ai-studio-applet-webapp-a5612.cloudfunctions.net/createAdminUser
```

If your project ID is different or the function deploys to a different region, update the URL in `src/pages/CreateAdmin.tsx`.

## How It Works

1. An authenticated admin visits the "Create Admins" page
2. They fill in email and name for the new admin
3. The app sends a request to the Cloud Function with their ID token
4. The function verifies they are an admin
5. If verified, it creates a new user in Firebase Auth with the provided credentials
6. A user document is created in Firestore with `role: 'admin'`
7. The new admin can immediately log in with their email and the generated password

## Security

The Cloud Function:
- Verifies authentication via ID token
- Confirms the requester has admin role in Firestore
- Validates email and password before creating
- Stores admin creation logs in Firestore

## Troubleshooting

### "Permission denied" error
- Make sure you're logged in to Firebase CLI: `firebase login`
- Check that your Google Cloud project has billing enabled
- Verify you have the correct project ID in `firebase.json`

### Function can't be called from the frontend
- Check that the function URL is correct in `CreateAdmin.tsx`
- Ensure CORS is enabled (it is in the function)
- Check browser console for detailed error messages

### "Firestore operation failed"
- Verify the `users` collection exists
- Check Firestore security rules allow the Cloud Function to write

## Monitoring

View function logs:
```bash
firebase functions:log
```

Or check the Firebase Console → Functions → Logs

## Local Development

To test locally with emulator:

```bash
firebase emulators:start
```

Then update the URL in `CreateAdmin.tsx` to use the local emulator.
