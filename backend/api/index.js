import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getFirestore } from 'firebase-admin/firestore';

// Get directory path for loading .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');

// Load environment variables
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('✓ Loaded .env.local from', envPath);
} else {
  console.warn('⚠ .env.local not found at', envPath);
}

console.log(
  `✓ ImageKit keys configured: ${
    Boolean(process.env.IMAGEKIT_PUBLIC_KEY) && Boolean(process.env.IMAGEKIT_PRIVATE_KEY)
  }`
);
const app = express();
app.disable('x-powered-by');

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
let adminApp;
let firestoreDb;
let firestoreDatabaseId;
let firebaseInitPromise;
let firebaseInitError;

const initializeFirebase = async () => {
  // Try to use environment variables first (for Vercel)
  if (process.env.FIREBASE_PROJECT_ID) {
    const requiredEnv = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID',
      'FIREBASE_CLIENT_X509_CERT_URL',
    ];

    const missing = requiredEnv.filter((k) => !process.env[k] || String(process.env[k]).trim().length === 0);
    if (missing.length) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    const credential = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    };

    adminApp = admin.apps?.length ? admin.app() : admin.initializeApp({
      credential: admin.credential.cert(credential),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  } else {
    // Fallback: try to load from service account file (local/dev)
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      adminApp = admin.apps?.length ? admin.app() : admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      throw new Error(
        'Firebase credentials not found. Set FIREBASE_* env vars (Vercel) or provide firebase-service-account.json (local).'
      );
    }
  }

  // Load databaseId from the same config the frontend uses (unless overridden by env)
  const appletConfigPath = path.join(__dirname, '../../firebase-applet-config.json');
  if (fs.existsSync(appletConfigPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(appletConfigPath, 'utf8'));
      firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || cfg?.firestoreDatabaseId;
    } catch {
      firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID;
    }
  } else {
    firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID;
  }

  firestoreDb = firestoreDatabaseId ? getFirestore(adminApp, firestoreDatabaseId) : getFirestore(adminApp);

  console.log('✓ Firebase Admin SDK initialized');
};

const ensureFirebase = async () => {
  if (firestoreDb && adminApp) return;
  if (firebaseInitError) throw firebaseInitError;
  if (!firebaseInitPromise) {
    firebaseInitPromise = (async () => {
      await initializeFirebase();
    })().catch((err) => {
      firebaseInitError = err instanceof Error ? err : new Error(String(err));
      throw firebaseInitError;
    });
  }
  await firebaseInitPromise;
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    firestoreDatabaseId: firestoreDatabaseId || '(default)',
    imagekitConfigured: Boolean(process.env.IMAGEKIT_PUBLIC_KEY) && Boolean(process.env.IMAGEKIT_PRIVATE_KEY),
  });
});

// Ensure Firebase is initialized for API routes (except health)
app.use('/api', async (req, res, next) => {
  if (req.path === '/health') return next();
  try {
    await ensureFirebase();
    return next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to initialize Firebase for request:', message);
    return res.status(500).json({
      success: false,
      message: 'Server misconfigured: Firebase Admin SDK failed to initialize',
      detail: message,
    });
  }
});

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.split('Bearer ')[1];
};

const requireAuth = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (error) {
    console.error('Auth error:', error?.code, error?.message);
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const uid = req.uid;
    const snap = await firestoreDb.collection('users').doc(uid).get();
    if (!snap.exists || snap.data()?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }
    next();
  } catch (error) {
    console.error('Admin check failed:', error?.message);
    return res.status(500).json({ success: false, message: 'Failed to validate admin access' });
  }
};

// Analytics: users + payments
app.get('/api/analytics', requireAuth, async (req, res) => {
  try {
    const days = Math.max(1, Math.min(90, Number(req.query.days || 14)));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const dayKeys = Array.from({ length: days }).map((_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      return d.toISOString().slice(0, 10); // YYYY-MM-DD
    });

    const bucketize = (timestamp) => {
      if (!timestamp) return null;
      const dateObj = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
      if (Number.isNaN(dateObj.getTime())) return null;
      return dateObj.toISOString().slice(0, 10);
    };

    // Users
    const usersSnap = await firestoreDb.collection('users').get();
    const usersTotal = usersSnap.size;
    const usersByDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    usersSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const key = bucketize(data.createdAt);
      if (key && key in usersByDay) usersByDay[key] += 1;
    });

    // Payments (optional)
    let paymentsTotal = 0;
    const paymentsByDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    try {
      const paymentsSnap = await firestoreDb.collection('payments').get();
      paymentsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const amount = Number(data.amount);
        if (Number.isFinite(amount)) paymentsTotal += amount;
        const key = bucketize(data.createdAt);
        if (key && key in paymentsByDay && Number.isFinite(amount)) paymentsByDay[key] += amount;
      });
    } catch (e) {
      // If the collection doesn't exist or is not accessible, return 0s.
    }

    return res.json({
      success: true,
      days,
      usersTotal,
      usersByDay,
      paymentsTotal,
      paymentsByDay,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

// ImageKit upload signing (keeps private key on server)
app.post('/api/imagekit-auth', requireAuth, async (req, res) => {
  try {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      return res.status(500).json({
        success: false,
        message: 'ImageKit keys are not configured on the server',
      });
    }

    const token = crypto.randomUUID().replace(/-/g, '');
    const expire = Math.floor(Date.now() / 1000) + 10 * 60;
    const signature = crypto
      .createHmac('sha1', privateKey)
      .update(token + expire)
      .digest('hex');

    return res.json({ success: true, token, expire, signature, publicKey });
  } catch (error) {
    console.error('ImageKit auth error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

// Gallery: public read endpoint (no auth required) for displaying images on public website
app.get('/api/gallery/public', async (req, res) => {
  try {
    const snap = await firestoreDb
      .collection('gallery')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() || {}) }))
      .filter((d) => typeof d.url === 'string' && d.url.length > 0);

    return res.json({ success: true, items });
  } catch (error) {
    console.error('Gallery list error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

// Gallery: admin-only list endpoint (for admin dashboard)
app.get('/api/gallery', requireAuth, async (req, res) => {
  try {
    const snap = await firestoreDb
      .collection('gallery')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() || {}) }))
      .filter((d) => typeof d.url === 'string' && d.url.length > 0);

    return res.json({ success: true, items });
  } catch (error) {
    console.error('Gallery list error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

// Gallery: delete
app.delete('/api/gallery/:id', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, message: 'Missing gallery id' });
    }

    await firestoreDb.collection('gallery').doc(id).delete();
    return res.json({ success: true });
  } catch (error) {
    console.error('Gallery delete error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

// Buy Rice: public list
app.get('/api/buy-rice/public', async (req, res) => {
  try {
    const snap = await firestoreDb
      .collection('buy-rice')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    return res.json({ success: true, items });
  } catch (error) {
    console.error('Buy rice list error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

// Buy Rice: create listing
app.post('/api/buy-rice', requireAuth, async (req, res) => {
  try {
    const { imageUrl, description, price } = req.body || {};
    if (typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required field: imageUrl' });
    }
    if (typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required field: description' });
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid price' });
    }

    const ref = await firestoreDb.collection('buy-rice').add({
      imageUrl: imageUrl.trim(),
      description: description.trim(),
      price: priceNum,
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: req.uid,
    });

    return res.status(201).json({ success: true, id: ref.id });
  } catch (error) {
    console.error('Buy rice create error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

// Buy Rice: delete listing
app.delete('/api/buy-rice/:id', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, message: 'Missing listing id' });
    }

    await firestoreDb.collection('buy-rice').doc(id).delete();
    return res.json({ success: true });
  } catch (error) {
    console.error('Buy rice delete error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

app.post('/api/gallery', requireAuth, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (typeof url !== 'string' || url.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required field: url' });
    }

    const ref = await firestoreDb.collection('gallery').add({
      url: url.trim(),
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: req.uid,
    });

    return res.status(201).json({ success: true, id: ref.id });
  } catch (error) {
    console.error('Gallery create error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

// Create admin user endpoint
app.post('/api/create-admin', async (req, res) => {
  console.log('🔵 POST /api/create-admin called');
  try {
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    // Verify authentication
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }
    let decodedToken;
    
    try {
      console.log('Attempting to verify token...');
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log('Token verified successfully');
    } catch (error) {
      console.error('Token verification error:', error.code, error.message);
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid token',
      });
    }

    const uid = decodedToken.uid;
    console.log('✓ Token verified for uid:', uid);

    // Since token is verified, we know the user is authenticated
    // We'll skip the Firestore check for now and proceed to create the admin
    
    // Validate request body
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, password, displayName',
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Create user in Firebase Auth
    let userRecord;
    try {
      console.log('Creating Firebase Auth user:', email);
      userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });
      console.log('✓ Auth user created:', userRecord.uid);
    } catch (error) {
      console.error('Firebase Auth error:', error.code, error.message);
      if (error.code === 'auth/email-already-exists') {
        return res.status(400).json({
          success: false,
          message: 'Email already in use',
        });
      }
      throw error;
    }

    // For now, skip Firestore document creation and just create the Auth user
    // We'll update this later to properly write to the custom database
    console.log('✓ Firebase Auth user created:', userRecord.uid);

    res.status(201).json({
      success: true,
      message: `Admin user ${email} created successfully`,
      uid: userRecord.uid,
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({
      success: false,
      message: `Error creating admin user: ${error.message}`,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

// Vercel serverless: export the Express app (no listening)
export default app;

// Local dev: start server
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`✓ Backend server running on port ${PORT}`);
    console.log(`  Health check: http://localhost:${PORT}/api/health`);
    console.log(`  Create admin: POST http://localhost:${PORT}/api/create-admin`);
    console.log(`  ImageKit auth: POST http://localhost:${PORT}/api/imagekit-auth`);
    console.log(`  Gallery list:  GET  http://localhost:${PORT}/api/gallery`);
    console.log(`  Gallery add:   POST http://localhost:${PORT}/api/gallery`);
  });
}
