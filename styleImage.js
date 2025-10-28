/**
 * Style Image Service
 * Uses unified replicateService for all Replicate error handling
 * Handles: nano-banana model for image styling
 */

import { runReplicateModel } from './replicateService.js';
import sharp from 'sharp';

const NANO_BANANA_MODEL = 'google/nano-banana';

/**
 * Normalizes image by removing EXIF data and correcting orientation.
 * This prevents unexpected rotations from auto-orienting.
 * 
 * @param {string} base64Image - Base64 encoded image
 * @returns {Promise<string>} Normalized base64 image
 */
async function normalizeImageExif(base64Image) {
    try {
        console.log('Normalizing EXIF data for image...');
        
        const base64Data = base64Image.replace(/^data:image\/[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const processedBuffer = await sharp(buffer)
            .rotate()
            .toBuffer();

        return `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;
        
    } catch (error) {
        console.error('EXIF normalization failed:', error.message);
        return base64Image;
    }
}

/**
 * Normalizes an array of base64 images
 * 
 * @param {string[]} imageArray - Array of base64 images
 * @returns {Promise<string[]>} Array of normalized base64 images
 */
async function normalizeImageArrayExif(imageArray) {
    if (!imageArray || imageArray.length === 0) {
        return imageArray;
    }

    try {
        console.log(`Normalizing EXIF data for ${imageArray.length} image(s)...`);
        const normalizedImages = await Promise.all(
            imageArray.map(img => normalizeImageExif(img))
        );
        return normalizedImages;
    } catch (error) {
        console.error('Error normalizing image array:', error.message);
        return imageArray;
    }
}

/**
 * Extracts image URL from various Replicate response formats
 * Handles FileOutput objects, arrays, and strings
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
    if (typeof output === 'string') {
        if (output.startsWith('http')) {
            console.log('✓ Output is direct URL string');
            return output;
        }
    }

    // Case 2: Array of URLs or objects
    if (Array.isArray(output) && output.length > 0) {
        console.log('✓ Output is array with', output.length, 'items');
        const firstItem = output[0];
        
        if (typeof firstItem === 'string') {
            if (firstItem.startsWith('http')) {
                console.log('✓ First item is URL string');
                return firstItem;
            }
        }
        
        if (typeof firstItem === 'object' && firstItem !== null) {
            console.log('✓ First item is object, attempting to extract URL');
            return extractFromFileOutput(firstItem);
        }
    }

    // Case 3: Single object (likely FileOutput)
    if (typeof output === 'object' && output !== null && !Array.isArray(output)) {
        console.log('✓ Output is single object, attempting to extract URL');
        return extractFromFileOutput(output);
    }

    // If we get here, log what we have
    console.error('❌ Could not extract URL. Output details:');
    console.error('  Type:', typeof output);
    console.error('  Is array:', Array.isArray(output));
    if (typeof output === 'object') {
        console.error('  Constructor:', output.constructor?.name);
        console.error('  Keys:', Object.keys(output));
    }
    
    throw new Error(
        `Could not extract URL from Replicate response. ` +
        `Type: ${typeof output}, Constructor: ${output?.constructor?.name || 'unknown'}`
    );
}

/**
 * Helper to extract URL from FileOutput object
 * FileOutput is a special Replicate class that wraps file data
 * 
 * @param {object} fileOutput - FileOutput object
 * @returns {string} URL
 * @throws {Error} If no valid URL found
 */
function extractFromFileOutput(fileOutput) {
    console.log('Attempting to extract from FileOutput object...');
    console.log('  Constructor:', fileOutput.constructor?.name);
    console.log('  Keys:', Object.keys(fileOutput));
    
    // Try .url() method first - this is the primary method for FileOutput
    if (typeof fileOutput.url === 'function') {
        try {
            const url = fileOutput.url();
            if (url && typeof url === 'string') {
                console.log('✓ Extracted URL using .url() method');
                return url;
            }
        } catch (e) {
            console.log('✗ .url() method threw error:', e.message);
        }
    }

    // Try .url property
    if (typeof fileOutput.url === 'string') {
        if (fileOutput.url.startsWith('http')) {
            console.log('✓ Extracted URL using .url property');
            return fileOutput.url;
        }
    }

    // Try toString() - might return the URL
    if (typeof fileOutput.toString === 'function') {
        try {
            const str = fileOutput.toString();
            if (typeof str === 'string' && str.startsWith('http')) {
                console.log('✓ Extracted URL using toString()');
                return str;
            }
        } catch (e) {
            console.log('✗ toString() threw error:', e.message);
        }
    }

    // Try alternative properties
    const alternatives = ['path', 'uri', 'href', 'link', 'data'];
    for (const prop of alternatives) {
        if (fileOutput[prop] && typeof fileOutput[prop] === 'string') {
            if (fileOutput[prop].startsWith('http')) {
                console.log(`✓ Extracted URL using .${prop} property`);
                return fileOutput[prop];
            }
        }
    }

    // Log all properties for debugging
    console.error('❌ Could not extract URL from FileOutput. All properties:');
    for (const key in fileOutput) {
        const val = fileOutput[key];
        const valStr = typeof val === 'function' ? '[Function]' : String(val).substring(0, 100);
        console.error(`    ${key}: ${typeof val} = ${valStr}`);
    }

    throw new Error(
        `FileOutput has no valid URL. Constructor: ${fileOutput.constructor?.name}, Keys: ${Object.keys(fileOutput).join(', ')}`
    );
}

/**
 * Styles/transforms images using nano-banana model
 * Can accept 1 or 2 images
 * 
 * Error handling is centralized in replicateService.js
 * 
 * @param {string[]} imageArray - Array of base64 images (1 or 2)
 * @param {string} stylePrompt - Text prompt describing the desired style/transformation
 * @returns {Promise<string>} URL of styled image
 * @throws {Error} NSFW_BLOCKED, PAYMENT_REQUIRED, or GENERATION_FAILED
 */
export const styleImage = async (imageArray, stylePrompt) => {
    // Validation
    if (!imageArray || imageArray.length === 0) {
        const error = new Error('At least one image is required for styling');
        error.statusCode = 400;
        throw error;
    }

    if (imageArray.length > 2) {
        const error = new Error('Maximum of 2 images allowed');
        error.statusCode = 400;
        throw error;
    }

    if (!stylePrompt || typeof stylePrompt !== 'string') {
        const error = new Error('Style prompt is required and must be a string');
        error.statusCode = 400;
        throw error;
    }

    try {
        // Step 1: Normalize images
        console.log(`Step 1: Normalizing ${imageArray.length} image(s)`);
        const normalizedImages = await normalizeImageArrayExif(imageArray);

        // Step 2: Call Replicate model
        console.log('Step 2: Calling nano-banana model');
        const output = await runReplicateModel(NANO_BANANA_MODEL, {
            image_input: normalizedImages,
            prompt: stylePrompt,
            aspect_ratio: "match_input_image",
            output_format: "jpg"
        });

        // Step 3: Extract URL
        console.log('Step 3: Extracting URL from response');
        const imageUrl = extractImageUrl(output);

        console.log('Step 4: Image styling complete');
        console.log('Result URL:', imageUrl);
        
        return imageUrl;

    } catch (error) {
        console.error('Image styling error:', error.message);
        throw error;
    }
};

/**
 * Styles a single image using nano-banana model
 * Wrapper for convenience when only 1 image is used
 * 
 * @param {string} base64Image - Single base64 image
 * @param {string} stylePrompt - Text prompt describing the style
 * @returns {Promise<string>} URL of styled image
 */
export const styleSingleImage = async (base64Image, stylePrompt) => {
    if (!base64Image) {
        const error = new Error('Image is required for styling');
        error.statusCode = 400;
        throw error;
    }

    return styleImage([base64Image], stylePrompt);
};

/**
 * Generates images using seedream-4 model
 * Can accept optional reference images
 * 
 * Error handling is centralized in replicateService.js
 * 
 * @param {string} prompt - Text prompt describing the image to generate
 * @param {string[]} imageArray - Optional array of base64 reference images
 * @param {Object} options - Optional configuration (size, etc.)
 * @returns {Promise<string>} URL of generated image
 * @throws {Error} NSFW_BLOCKED, PAYMENT_REQUIRED, or GENERATION_FAILED
 */

// this is back in time
export const generateImageSeedream = async (prompt, imageArray = [], options = {}) => {
    // Validation
    if (!prompt) {
        const error = new Error('Prompt is required for image generation');
        error.statusCode = 400;
        throw error;
    }

    const SEEDREAM_MODEL = 'bytedance/seedream-4';

    try {
        // Step 1: Normalize reference images if provided
        let normalizedImages = imageArray;
        if (imageArray && imageArray.length > 0) {
            console.log(`Step 1: Normalizing ${imageArray.length} reference image(s)`);
            normalizedImages = await normalizeImageArrayExif(imageArray);
        } else {
            console.log('Step 1: No reference images provided');
        }

        // Step 2: Call Replicate model
        console.log('Step 2: Calling seedream-4 model');
        const defaultOptions = {
            size: "2K",
            image_input: normalizedImages || [],
            enhance_prompt: true,
            sequential_image_generation: "disabled"
        };

        const input = {
            ...defaultOptions,
            ...options,
            prompt: prompt
        };

        const output = await runReplicateModel(SEEDREAM_MODEL, input);

        // Step 3: Extract URL
        console.log('Step 3: Extracting URL from response');
        const imageUrl = extractImageUrl(output);

        console.log('Step 4: Image generation complete');
        console.log('Result URL:', imageUrl);
        
        return imageUrl;

    } catch (error) {
        console.error('Image generation error:', error.message);
        throw error;
    }
};