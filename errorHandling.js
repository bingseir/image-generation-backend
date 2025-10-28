/**
 * Global Error Handler Middleware
 * Catches all errors from routes and formats them consistently
 * Place this LAST in your middleware chain in the main app.js
 */

export const errorHandler = (err, req, res, next) => {
    console.error('=== API Error ===');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    console.error('================');

    // NSFW Content Blocked (Input or Output) - Return 400
    if (err.message === 'NSFW_BLOCKED') {
        return res.status(400).json({
            success: false,
            error: 'NSFW_BLOCKED',
            message: err.userMessage || 'The design could not be generated due to content safety filters. Please try a different prompt.'
        });
    }

    // Payment Required (Insufficient Credit) - Return 402
    if (err.message === 'PAYMENT_REQUIRED') {
        return res.status(402).json({
            success: false,
            error: 'PAYMENT_REQUIRED',
            message: err.userMessage || 'Insufficient credit to generate images.'
        });
    }

    // Generation Failed - Return 500
    if (err.message === 'GENERATION_FAILED') {
        return res.status(500).json({
            success: false,
            error: 'GENERATION_FAILED',
            message: err.userMessage || 'Failed to generate. Please try again.'
        });
    }

    // Replicate Prediction Failed (catches remaining prediction errors)
    if (err.message && err.message.includes('Prediction failed')) {
        return res.status(500).json({
            success: false,
            error: 'GENERATION_FAILED',
            message: 'Failed to generate. Please try again.'
        });
    }

    // Validation Errors (4xx)
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.error || 'Validation Error',
            message: err.message
        });
    }

    // Default Internal Server Error
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred.'
    });
};