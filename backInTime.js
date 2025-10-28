import Replicate from 'replicate';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Replicate once
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

const model = "google/nano-banana";

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
 * Normalizes an array of base64 images
 * @param {string[]} imageArray - Array of base64 encoded images
 * @returns {Promise<string[]>} Array of normalized base64 images
 */
async function normalizeImageArrayExif(imageArray) {
    if (!imageArray || imageArray.length === 0) {
        return imageArray;
    }

    try {
        const normalizedImages = await Promise.all(
            imageArray.map(img => normalizeImageExif(img))
        );
        return normalizedImages;
    } catch (error) {
        console.error('Error normalizing image array:', error);
        return imageArray;
    }
}

/**
 * Extracts the image URL from various Replicate output formats.
 * @param {any} output - The output from Replicate API
 * @returns {string} The URL of the resulting image
 * @throws {Error} If URL cannot be extracted
 */
function extractImageUrl(output) {
    // Handle string output
    if (typeof output === 'string') {
        return output;
    }

    // Handle object with url property
    if (typeof output === 'object' && output !== null) {
        if (typeof output.url === 'function') {
            return output.url();
        } else if (typeof output.url === 'string') {
            return output.url;
        }
    }

    // Handle array output
    if (Array.isArray(output) && output.length > 0) {
        const item = output[0];
        
        if (typeof item === 'string') {
            return item;
        }
        
        if (typeof item === 'object' && item !== null) {
            if (typeof item.url === 'function') {
                return item.url();
            } else if (typeof item.url === 'string') {
                return item.url;
            }
        }
    }

    throw new Error(`Unexpected output format: ${JSON.stringify(output)}`);
}

/**
 * Calls the Replicate API to style a single image.
 * @param {string} base64Image - A single base64 encoded image.
 * @param {string} styleString - The prompt describing the desired style/transformation.
 * @returns {Promise<string>} The URL of the resulting styled image from Replicate.
 * @throws {Error} If image or style prompt is missing, or API call fails
 */
async function styleSingleImage(base64Image, styleString) {
    if (!base64Image) {
        throw new Error('Image is required for styling.');
    }

    if (!styleString || typeof styleString !== 'string') {
        throw new Error('Style prompt is required and must be a string.');
    }

    console.log('Normalizing EXIF data for single image...');
    // Normalize the image to prevent rotation issues
    const normalizedImage = await normalizeImageExif(base64Image);

    console.log('Running Replicate nano-banana model with 1 image...');

    const output = await replicate.run(model, {
        input: {
            image_input: [normalizedImage],  // Single image in array
            prompt: styleString,
            aspect_ratio: "match_input_image",
            output_format: "jpg"
        }
    });

    const imageUrl = extractImageUrl(output);
    console.log('Single image processed successfully. Output URL:', imageUrl);
    return imageUrl;
}

/**
 * Calls the Replicate API to style/composite multiple images.
 * @param {string[]} imageArray - Array of base64 images (1 or 2 images).
 * @param {string} styleString - The prompt describing the desired style/composition.
 * @returns {Promise<string>} The URL of the resulting styled image from Replicate.
 * @throws {Error} If images or style prompt is missing, or API call fails
 */
async function styleMultipleImages(imageArray, styleString) {
    if (!imageArray || !Array.isArray(imageArray) || imageArray.length === 0) {
        throw new Error('At least one image is required for styling.');
    }

    if (imageArray.length > 2) {
        throw new Error('Maximum of 2 images allowed.');
    }

    if (!styleString || typeof styleString !== 'string') {
        throw new Error('Style prompt is required and must be a string.');
    }

    console.log(`Normalizing EXIF data for ${imageArray.length} image(s)...`);
    // Normalize all images to prevent rotation issues
    const normalizedImages = await normalizeImageArrayExif(imageArray);

    console.log(`Running Replicate nano-banana model with ${normalizedImages.length} image(s)...`);

    const output = await replicate.run(model, {
        input: {
            image_input: normalizedImages,  // Pass the array (1 or 2 images)
            prompt: styleString,
            aspect_ratio: "match_input_image",
            output_format: "jpg"
        }
    });

    const imageUrl = extractImageUrl(output);
    console.log(`${normalizedImages.length} image(s) processed successfully. Output URL:`, imageUrl);
    return imageUrl;
}

/**
 * Calls the Replicate API to style/composite images (backward compatible).
 * Automatically routes to single or multiple image function based on input.
 * @param {string|string[]} imageInput - Either a base64 image string or array of base64 images.
 * @param {string} styleString - The prompt describing the desired style/composition.
 * @returns {Promise<string>} The URL of the resulting styled image from Replicate.
 * @throws {Error} If images or style prompt is missing, or API call fails
 */
async function styleImage(imageInput, styleString) {
    if (!imageInput) {
        throw new Error('At least one image is required for styling.');
    }

    if (!styleString) {
        throw new Error('Style prompt is missing.');
    }

    // Handle single image (string input)
    if (typeof imageInput === 'string') {
        return styleSingleImage(imageInput, styleString);
    }

    // Handle multiple images (array input)
    if (Array.isArray(imageInput)) {
        return styleMultipleImages(imageInput, styleString);
    }

    throw new Error('Image input must be a base64 string or array of base64 strings.');
}

export { styleSingleImage, styleMultipleImages, styleImage };