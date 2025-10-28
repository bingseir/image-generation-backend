import { runReplicateModel } from './replicateService.js';
import sharp from 'sharp';

/**
 * Normalizes image by removing EXIF data and correcting orientation.
 * This prevents unexpected rotations from auto-orienting.
 * @param {string} base64Image - A base64 encoded image string
 * @returns {Promise<string>} A normalized base64 image string
 */
async function normalizeImageExif(base64Image) {
    try {
        // Remove 'data:image/jpeg;base64,' or similar prefix if present
        const base64Data = base64Image.replace(/^data:image\/[^;]+;base64,/, '');
        
        // Convert base64 to buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // Use sharp to:
        // 1. Auto-orient the image based on EXIF data
        // 2. Remove all EXIF metadata
        // 3. Convert back to base64
        const processedBuffer = await sharp(buffer)
            .rotate() // Auto-rotates based on EXIF orientation, then removes EXIF
            .toBuffer();

        // Convert back to base64
        const normalizedBase64 = processedBuffer.toString('base64');
        
        // Return with proper data URI prefix
        return `data:image/jpeg;base64,${normalizedBase64}`;
    } catch (error) {
        console.error('Error normalizing EXIF data:', error);
        // If normalization fails, return the original image
        return base64Image;
    }
}

/**
 * Normalizes all images in the input payload if they exist
 * @param {object} inputPayload - The input object from the client
 * @returns {Promise<object>} The payload with normalized images
 */
async function normalizePayloadImages(inputPayload) {
    if (!inputPayload) {
        return inputPayload;
    }

    // Create a copy to avoid mutating the original
    const normalizedPayload = { ...inputPayload };

    // Common image field names to check and normalize
    const imageFields = ['image', 'image_input', 'reference_image', 'conditioning_image', 'mask_image'];

    for (const field of imageFields) {
        if (normalizedPayload[field]) {
            if (typeof normalizedPayload[field] === 'string') {
                // Single image string
                console.log(`Normalizing EXIF data for field: ${field}`);
                normalizedPayload[field] = await normalizeImageExif(normalizedPayload[field]);
            } else if (Array.isArray(normalizedPayload[field])) {
                // Array of images
                console.log(`Normalizing EXIF data for array field: ${field}`);
                normalizedPayload[field] = await Promise.all(
                    normalizedPayload[field].map(img => 
                        typeof img === 'string' ? normalizeImageExif(img) : img
                    )
                );
            }
        }
    }

    return normalizedPayload;
}

/**
 * Runs the image generation model with a given input payload.
 * Uses the replicateService for consistent error handling.
 * 
 * @param {object} inputPayload - The input object from the client (req.body)
 * @returns {Promise<string>} The URL of the generated image
 * @throws Will throw NSFW_BLOCKED or GENERATION_FAILED on error
 */
export async function generateImage(inputPayload) {
    // Validate input
    if (!inputPayload || !inputPayload.prompt) {
        throw new Error('Prompt is required for image generation');
    }
  
    console.log("Starting image generation with payload:", inputPayload.prompt.substring(0, 50) + '...');

    // Normalize any images in the payload to fix EXIF rotation issues
    console.log("Normalizing EXIF data in payload...");
    const normalizedPayload = await normalizePayloadImages(inputPayload);

    // The model identifier
    const modelIdentifier = "google/imagen-4";
    
    console.log(`Running Replicate model: ${modelIdentifier}`);
    
    // Use the service layer for error handling
    const output = await runReplicateModel(modelIdentifier, normalizedPayload);
    
    // Replicate output is usually an array of FileOutput objects
    const imageOutput = Array.isArray(output) ? output[0] : output;

    if (imageOutput && imageOutput.url) {
        // Return the URL for the Express route to send back to the client
        console.log('Image generation successful');
        return imageOutput.url();
    } else {
        // Throw an error if the model ran but didn't return a valid URL
        throw new Error("Model ran successfully but returned no image URL.");
    }
}