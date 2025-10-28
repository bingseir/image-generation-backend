import imageProcessorRouter from './routes/imageProcessor.js';
import { errorHandler } from './errorHandling.js';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000;

// ========== MIDDLEWARE SETUP ==========
app.use(cors()); // Enable CORS
app.use(express.json()); // Enable parsing of JSON body payloads
app.use(express.urlencoded({ extended: true })); // Enable parsing URL-encoded bodies

// ========== ROUTE REGISTRATION ==========
// Attach the imageProcessorRouter to the base path '/api'
app.use('/api', imageProcessorRouter);

// ========== HEALTH CHECK ROUTE ==========
app.get('/', (req, res) => {
    res.send('Image Processing Server is Running.');
});

// ========== GLOBAL ERROR HANDLER (MUST BE LAST) ==========
// This catches all errors from any route and formats them consistently
app.use(errorHandler);

// ========== SERVER START ==========
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});