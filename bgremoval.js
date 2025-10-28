/**
 * Background Removal Service
 * Uses unified replicateService for all Replicate error handling
 * This keeps the code DRY and maintainable
 */

import { runReplicateModel } from './replicateService.js';
import sharp from 'sharp';

const MODEL = 'recraft-ai/recraft-remove-background';

/**
 * Normalizes image by removing EXIF data and correcting orientation.
 * This is specific to background removal to prevent rotation issues.
 * 
 * @param {string} base64Image - Base64 encoded image
 * @returns {Promise<string>} Normalized base64 image
 */
async function normalizeImageExif(base64Image) {
    try {
        console.log('Normalizing image EXIF data...');
        
        // Remove data URI prefix if present
        const base64Data = base64Image.replace(/^data:image\/[^;]+;base64,/, '');
        
        // Convert to buffer
        const buffer = Buffer.from(base64Data, 'base64');

        // Auto-rotate and remove EXIF data using sharp
        const processedBuffer = await sharp(buffer)
            .rotate()
            .toBuffer();

        // Convert back to base64 with prefix
        return `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;
        
    } catch (error) {
        console.error('EXIF normalization failed, using original image:', error.message);
        // Graceful fallback
        return base64Image;
    }
}

/**
 * Extracts image URL from Replicate response
 * Different models return different formats, so we handle them all
 * 
 * @param {*} output - Response from Replicate
 * @returns {string} Image URL
 * @throws {Error} If URL cannot be extracted
 */
function extractImageUrl(output) {
    console.log('Extracting URL from response...');
    console.log('Output type:', typeof output);
    console.log('Is array:', Array.isArray(output));
    
    // Case 1: Direct string URL
    if (typeof output === 'string' && output.startsWith('http')) {
        console.log('✓ Output is direct URL string');
        return output;
    }

    // Case 2: Array of URLs or objects
    if (Array.isArray(output) && output.length > 0) {
        console.log('✓ Output is array with', output.length, 'items');
        const firstItem = output[0];
        
        // Case 2a: Array of URL strings
        if (typeof firstItem === 'string' && firstItem.startsWith('http')) {
            console.log('✓ First item is URL string');
            return firstItem;
        }
        
        // Case 2b: Array of FileOutput objects
        if (typeof firstItem === 'object' && firstItem !== null) {
            console.log('✓ First item is object, extracting from FileOutput');
            return extractFromFileOutput(firstItem);
        }
    }

    // Case 3: Single FileOutput object
    if (typeof output === 'object' && output !== null && !Array.isArray(output)) {
        console.log('✓ Output is single object, extracting from FileOutput');
        return extractFromFileOutput(output);
    }

    // No valid URL found
    throw new Error(
        `Could not extract URL from Replicate response. ` +
        `Got type: ${typeof output}, is array: ${Array.isArray(output)}`
    );
}

/**
 * Helper to extract URL from FileOutput object
 * FileOutput objects are special Replicate types that may need .url() method
 * 
 * @param {object} fileOutput - FileOutput object
 * @returns {string} URL
 * @throws {Error} If no valid URL property found
 */
function extractFromFileOutput(fileOutput) {
    console.log('Extracting from FileOutput object...');
    
    // IMPORTANT: FileOutput instances use .url() method
    // Try .url() method first (this is the primary method for FileOutput)
    if (typeof fileOutput.url === 'function') {
        try {
            const url = fileOutput.url();
            if (url && typeof url === 'string' && url.startsWith('http')) {
                console.log('✓ Successfully extracted URL using .url() method');
                console.log('URL:', url);
                return url;
            }
        } catch (e) {
            console.log('✗ .url() method threw error:', e.message);
        }
    }

    // Try .url property (in case it's a plain object)
    if (typeof fileOutput.url === 'string' && fileOutput.url.startsWith('http')) {
        console.log('✓ Successfully extracted URL using .url property');
        console.log('URL:', fileOutput.url);
        return fileOutput.url;
    }

    // Try toString() - FileOutput might represent as URL when converted to string
    if (typeof fileOutput.toString === 'function') {
        try {
            const stringified = fileOutput.toString();
            if (typeof stringified === 'string' && stringified.startsWith('http')) {
                console.log('✓ Successfully extracted URL from toString()');
                console.log('URL:', stringified);
                return stringified;
            }
        } catch (e) {
            console.log('✗ toString() threw error:', e.message);
        }
    }

    // Try alternative properties
    const alternativeKeys = ['path', 'uri', 'href', 'link'];
    for (const key of alternativeKeys) {
        if (fileOutput[key] && typeof fileOutput[key] === 'string' && fileOutput[key].startsWith('http')) {
            console.log(`✓ Successfully extracted URL using .${key} property`);
            console.log('URL:', fileOutput[key]);
            return fileOutput[key];
        }
    }

    // Log what we have for debugging
    console.error('FileOutput extraction failed. Object details:');
    console.error('  Type:', typeof fileOutput);
    console.error('  Constructor:', fileOutput.constructor?.name);
    console.error('  Keys:', Object.keys(fileOutput));
    console.error('  toString():', tryStringify(fileOutput));

    // No valid URL found
    throw new Error(
        `FileOutput has no valid URL. ` +
        `Constructor: ${fileOutput.constructor?.name}, ` +
        `Keys: ${Object.keys(fileOutput).join(', ')}`
    );
}

/**
 * Safely stringify an object for debugging
 */
function tryStringify(obj) {
    try {
        return JSON.stringify(obj);
    } catch (e) {
        try {
            return String(obj);
        } catch (e2) {
            return '[unable to stringify]';
        }
    }
}

/**
 * Removes background from an image using Replicate
 * 
 * Error handling is centralized in replicateService.js, so this function
 * focuses only on the model-specific logic (EXIF normalization and URL extraction)
 * 
 * @param {string} imageBase64 - Base64 encoded image
 * @returns {Promise<string>} URL of image with background removed
 * @throws {Error} NSFW_BLOCKED, PAYMENT_REQUIRED, or GENERATION_FAILED
 */
export const removeBackground = async (imageBase64) => {
    if (!imageBase64) {
        const error = new Error('Image data is required for background removal');
        error.statusCode = 400;
        throw error;
    }

    try {
        console.log('Step 1: Normalizing image EXIF data');
        const normalizedImage = await normalizeImageExif(imageBase64);

        console.log('Step 2: Calling Replicate API');
        // All error handling (402, NSFW, rate limit, etc) is handled by replicateService
        const output = await runReplicateModel(MODEL, {
            image: normalizedImage
        });

        console.log('Step 3: Extracting URL from response');
        const imageUrl = extractImageUrl(output);

        console.log('Step 4: Background removal complete');
        console.log('Result URL:', imageUrl);
        
        return imageUrl;

    } catch (error) {
        console.error('Background removal error:', error.message);
        
        // Errors from runReplicateModel are already properly formatted
        // Just re-throw them
        throw error;
    }
};