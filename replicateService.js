/**
 * Replicate Service Wrapper
 * Standardizes error handling for all Replicate API calls
 * Use this in: addTattoo.js, textToImg.js, styleImage.js, bgremoval.js
 */

import Replicate from 'replicate';
import dotenv from 'dotenv';

dotenv.config();

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

/**
 * Runs any Replicate model and handles errors consistently
 * @param {string} model - The model identifier (e.g., "black-forest-labs/flux-fill-pro")
 * @param {object} input - The input parameters for the model
 * @returns {Promise<any>} The model output
 * @throws {Error} Custom error with NSFW_BLOCKED or GENERATION_FAILED message
 */
export const runReplicateModel = async (model, input) => {
    try {
        console.log(`Running Replicate model: ${model}`);
        const output = await replicate.run(model, { input });
        console.log('Model execution successful');
        return output;
    } catch (error) {
        console.error('Replicate API Error:', error.message);

        // Handle NSFW Content Detection (Input)
        if (error.message && error.message.includes('NSFW content detected')) {
            const nsfwError = new Error('NSFW_BLOCKED');
            nsfwError.userMessage = 'The design could not be generated because it was flagged as adult content. Try a different design or adjust your prompt to be more specific.';
            throw nsfwError;
        }

        // Handle Sensitive Output Detection
        if (error.message && error.message.includes('flagged as sensitive')) {
            const sensitiveError = new Error('NSFW_BLOCKED');
            sensitiveError.userMessage = 'The generated design was flagged as sensitive content. Please try a different design or adjust your prompt.';
            throw sensitiveError;
        }

        // Handle Payment Required (Insufficient Credit)
        if (error.message && error.message.includes('402')) {
            const paymentError = new Error('PAYMENT_REQUIRED');
            paymentError.userMessage = 'Insufficient credit to generate images.';
            throw paymentError;
        }

        // Handle Prediction Failures (Generic)
        if (error.message && error.message.includes('Prediction failed')) {
            const genError = new Error('GENERATION_FAILED');
            genError.userMessage = 'Failed to generate. Please try again.';
            throw genError;
        }

        // Handle Rate Limiting or API Issues
        if (error.message && (error.message.includes('rate limit') || error.message.includes('429'))) {
            const rateLimitError = new Error('GENERATION_FAILED');
            rateLimitError.userMessage = 'Service is busy. Please try again in a moment.';
            throw rateLimitError;
        }

        // Re-throw unexpected errors
        throw error;
    }
};

export { replicate };