import express from 'express'; 
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import imageProcessorRouter from './routes/imageProcessor.js';
import { errorHandler } from './errorHandling.js';

// Load environment variables from .env file
dotenv.config();

console.log('Initializing Firebase...');

// Get Firebase credentials from environment variables
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

// Validate credentials
if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  console.error('❌ Firebase credentials not found!');
  console.error('Make sure your .env file has:');
  console.error('  - FIREBASE_PROJECT_ID');
  console.error('  - FIREBASE_CLIENT_EMAIL');
  console.error('  - FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

// Initialize Firebase
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MIDDLEWARE SETUP ==========
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ========== ROUTE REGISTRATION ==========
app.use('/api', imageProcessorRouter);

app.get('/', (req, res) => {
    res.send('Image Processing Server is Running.');
});

// ========== GLOBAL ERROR HANDLER ==========
app.use(errorHandler);

// ========== SERVER START ==========
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});