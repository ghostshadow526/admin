import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import crypto from 'crypto';

// Initialize Firebase Admin SDK
admin.initializeApp();

const corsHandler = cors({ origin: true });

interface CreateAdminRequest {
  email: string;
  password: string;
  displayName: string;
}

interface CreateAdminResponse {
  success: boolean;
  message: string;
  uid?: string;
}

/**
 * Cloud Function to create a new admin user
 * Only authenticated admins can call this function
 */
export const createAdminUser = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      // Check if user is authenticated
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized: No token provided',
        } as CreateAdminResponse);
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
        } as CreateAdminResponse);
        return;
      }

      // Validate request body
      const { email, password, displayName } = req.body as CreateAdminRequest;

      if (!email || !password || !displayName) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: email, password, displayName',
        } as CreateAdminResponse);
        return;
      }

      // Validate password strength (at least 6 characters)
      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters',
        } as CreateAdminResponse);
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
      } as CreateAdminResponse);
    } catch (error: any) {
      console.error('Error creating admin user:', error);

      // Handle Firebase-specific errors
      if (error.code === 'auth/email-already-exists') {
        res.status(400).json({
          success: false,
          message: 'Email already in use',
        } as CreateAdminResponse);
        return;
      }

      if (error.code === 'auth/invalid-email') {
        res.status(400).json({
          success: false,
          message: 'Invalid email address',
        } as CreateAdminResponse);
        return;
      }

      res.status(500).json({
        success: false,
        message: `Error creating admin user: ${error.message}`,
      } as CreateAdminResponse);
    }
  });
});

export const imagekitAuth = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const uid = context.auth.uid;
  const requesterDoc = await admin.firestore().collection('users').doc(uid).get();
  if (!requesterDoc.exists || requesterDoc.data()?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const cfg = functions.config();
  const publicKey =
    (cfg as any)?.imagekit?.public_key ||
    process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey =
    (cfg as any)?.imagekit?.private_key ||
    process.env.IMAGEKIT_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'ImageKit keys are not configured on the server'
    );
  }

  const token = crypto.randomUUID().replace(/-/g, '');
  const expire = Math.floor(Date.now() / 1000) + 10 * 60;
  const signature = crypto
    .createHmac('sha1', privateKey)
    .update(token + expire)
    .digest('hex');

  return { token, expire, signature, publicKey };
});
