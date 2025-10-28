import { runReplicateModel } from './replicateService.js';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config();

const model = "black-forest-labs/flux-fill-pro";

/**
 * Normalizes image by removing EXIF data and correcting orientation.
 * @param {string} base64Image - A base64 encoded image string
 * @returns {Promise<string>} A normalized base64 image string
 */
async function normalizeImageExif(base64Image) {
    try {
        const base64Data = base64Image.replace(/^data:image\/[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const processedBuffer = await sharp(buffer)
            .rotate()
            .toBuffer();

        const normalizedBase64 = processedBuffer.toString('base64');
        return `data:image/jpeg;base64,${normalizedBase64}`;
    } catch (error) {
        console.error('Error normalizing EXIF data:', error);
        return base64Image;
    }
}

/**
 * Adds a tattoo design to a photo using Replicate's flux-fill-pro model.
 * Errors are handled by replicateService and global error handler.
 * 
 * @param {string} prompt - The tattoo design description
 * @param {string} originalPhotoBase64 - The body/person photo
 * @param {string} resizedImageBase64 - The tattoo mask
 * @returns {Promise<string>} The resulting image URL
 * @throws Will throw NSFW_BLOCKED or GENERATION_FAILED on error
 */
export async function addTattoo(prompt, originalPhotoBase64, resizedImageBase64) { 
    if (!prompt || !originalPhotoBase64 || !resizedImageBase64) {
        throw new Error('Prompt, image data, or mask data is missing for image generation.');
    }

    console.log('Normalizing EXIF data for original photo and mask...');
    const normalizedOriginalPhoto = await normalizeImageExif(originalPhotoBase64);
    const normalizedMask = await normalizeImageExif(resizedImageBase64);

    const input = {
        image: normalizedOriginalPhoto, 
        mask: normalizedMask, 
        prompt: prompt,
        steps: 50,
        guidance: 60,
        outpaint: "None",
        output_format: "jpg",
        safety_tolerance: 2,
        prompt_upsampling: false
    };

    // Use the service layer - handles NSFW and generation errors
    const output = await runReplicateModel(model, input);

    let imageUrl = null;

    if (Array.isArray(output) && output.length > 0) {
        const firstItem = output[0];
        if (typeof firstItem.url === 'function') {
            imageUrl = firstItem.url();
        } else if (typeof firstItem === 'string') {
            imageUrl = firstItem;
        }
    } 
    else if (typeof output === 'object' && output !== null && typeof output.url === 'function') {
        imageUrl = output.url();
    }
    else if (typeof output === 'string') {
        imageUrl = output;
    } 
    else {
        console.error('Replicate Output (Unexpected):', output);
        throw new Error('Replicate returned an unexpected output format.');
    }

    if (!imageUrl) {
        throw new Error('Replicate did not return a valid generated image URL.');
    }

    console.log('Image generation done. Output URL:', imageUrl);
    return imageUrl;
}