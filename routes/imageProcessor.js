import express from 'express'; 
import multer from 'multer'; 
import { removeBackground } from '../bgremoval.js'; 
import { generateImage } from '../textToImg.js'; 
import { styleSingleImage, styleImage, generateImageSeedream } from '../styleImage.js';
import { addTattoo } from '../addtattoo.js';
import { checkGenerationLimit } from '../generationLimitMiddleware.js';
import { incrementGenerationCount } from '../db-firebase.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Utility to convert a file buffer to a base64 Data URL string
const bufferToBase64 = (buffer, mimeType) => 
    `data:${mimeType};base64,${buffer.toString('base64')}`;

// ============ BACKGROUND REMOVAL ============
router.post('/bg-removal', upload.single('image'), async (req, res, next) => {
    try {
        const fileBuffer = req.file?.buffer;
        const mimeType = req.file?.mimetype;

        if (!fileBuffer || !mimeType) {
            return res.status(400).json({ 
                error: 'Image file is required in the "image" field.' 
            });
        }

        const imageBase64 = bufferToBase64(fileBuffer, mimeType);
        const imageUrl = await removeBackground(imageBase64);

        res.json({ success: true, imageUrl });

    } catch (error) {
        next(error); // Pass to global error handler
    }
});

// ============ TEXT TO IMAGE (WITH LIMIT CHECK) ============
router.post('/generate-image', checkGenerationLimit, async (req, res, next) => {
    try {
        const input = req.body;
        const userId = req.body.userId;

        if (!input || !input.prompt) {
            return res.status(400).json({ 
                error: 'A valid input object with a prompt is required.' 
            });
        }
        
        const imageUrl = await generateImage(input);

        // Record generation for free users after successful creation
        if (!req.isSubscribed && userId) {
            await incrementGenerationCount(userId);
        }

        res.json({ 
            success: true, 
            imageUrl,
            remaining: req.remaining,
            isSubscribed: req.isSubscribed
        });

    } catch (error) {
        next(error); // Pass to global error handler
    }
});

// ============ STYLE IMAGE - SINGLE ============
router.post('/styleImage/single', upload.single('image'), async (req, res, next) => {
    try {
        const imageFile = req.file;
        const styleString = req.body.style;

        if (!imageFile) {
            return res.status(400).json({ 
                error: 'Image file is required in the "image" field.' 
            });
        }

        if (!styleString) {
            return res.status(400).json({ 
                error: 'Style prompt is required in the "style" field.' 
            });
        }

        const imageBase64 = bufferToBase64(imageFile.buffer, imageFile.mimetype);
        const imageUrl = await styleSingleImage(imageBase64, styleString);

        res.json({ success: true, imageUrl });

    } catch (error) {
        next(error); // Pass to global error handler
    }
});

// ============ STYLE IMAGE - DUAL ============
router.post('/styleImage', upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 }
]), async (req, res, next) => {
    try {
        const image1File = req.files?.image1?.[0];
        const image2File = req.files?.image2?.[0];
        const styleString = req.body.style;

        if (!image1File) {
            return res.status(400).json({ 
                error: 'At least image1 is required.' 
            });
        }

        if (!styleString) {
            return res.status(400).json({ 
                error: 'Style prompt is required in the "style" field.' 
            });
        }

        const image1Base64 = bufferToBase64(image1File.buffer, image1File.mimetype);
        const imageInputArray = [image1Base64];
        
        if (image2File) {
            const image2Base64 = bufferToBase64(image2File.buffer, image2File.mimetype);
            imageInputArray.push(image2Base64);
            console.log('Processing with 2 images');
        } else {
            console.log('Processing with 1 image');
        }

        const imageUrl = await styleImage(imageInputArray, styleString);
        res.json({ success: true, imageUrl });

    } catch (error) {
        next(error); // Pass to global error handler
    }
});

// ============ ADD TATTOO ============
router.post('/add-Tattoo', 
    upload.fields([
        { name: 'resizedImage', maxCount: 1 },
        { name: 'originalPhoto', maxCount: 1 }
    ]), 
    async (req, res, next) => {
        try {
            const prompt = req.body.prompt;
            const resizedImageFile = req.files?.resizedImage?.[0];
            const originalPhotoFile = req.files?.originalPhoto?.[0];

            if (!prompt) {
                return res.status(400).json({ 
                    error: 'Prompt is required for tattoo generation.' 
                });
            }

            if (!resizedImageFile || !originalPhotoFile) {
                return res.status(400).json({ 
                    error: 'Both image files are required.',
                    details: 'Please ensure "resizedImage" (mask) and "originalPhoto" are uploaded.'
                });
            }

            const resizedImageBase64 = bufferToBase64(
                resizedImageFile.buffer, 
                resizedImageFile.mimetype || 'image/png'
            );
            
            const originalPhotoBase64 = bufferToBase64(
                originalPhotoFile.buffer, 
                originalPhotoFile.mimetype || 'image/jpeg'
            );

            const imageUrl = await addTattoo(prompt, originalPhotoBase64, resizedImageBase64);
            res.json({ success: true, imageUrl });

        } catch (error) {
            next(error); // Pass to global error handler
        }
    }
);

// ============ GENERATE IMAGE (BACK IN TIME) ============
router.post('/generateImage', upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 }
]), async (req, res, next) => {
    try {
        const { prompt } = req.body;
        const image1File = req.files?.image1?.[0];
        const image2File = req.files?.image2?.[0];

        if (!prompt) {
            return res.status(400).json({ 
                error: 'Prompt is required.' 
            });
        }

        const imageInputArray = [];
        
        if (image1File) {
            const image1Base64 = bufferToBase64(image1File.buffer, image1File.mimetype);
            imageInputArray.push(image1Base64);
            console.log('Added reference image 1');
        }
        
        if (image2File) {
            const image2Base64 = bufferToBase64(image2File.buffer, image2File.mimetype);
            imageInputArray.push(image2Base64);
            console.log('Added reference image 2');
        }

        const imageUrl = await generateImageSeedream(prompt, imageInputArray);
        res.json({ success: true, imageUrl });

    } catch (error) {
        next(error); // Pass to global error handler
    }
});

export default router;