import { isUserSubscribed } from './revenuecat.js';
// Import one of these based on your choice:
// import { getTodayGenerationCount, getRemainingGenerations } from './db-firebase.js';
import { getTodayGenerationCount, getRemainingGenerations } from './db-firebase.js';

const DAILY_LIMIT = 5;

/**
 * Middleware to check if user can generate an image
 * Expects userId in req.body.userId (from RevenueCat)
 */
export const checkGenerationLimit = async (req, res, next) => {
  try {
    const userId = req.body.userId;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required in request body',
      });
    }

    // Check subscription status
    const isSubscribed = await isUserSubscribed(userId);

    // If subscribed, allow generation
    if (isSubscribed) {
      req.isSubscribed = true;
      return next();
    }

    // Check daily limit for free users
    const generationCount = await getTodayGenerationCount(userId);

    if (generationCount >= DAILY_LIMIT) {
      return res.status(429).json({
        error: 'Daily generation limit reached',
        message: `You have reached your daily limit of ${DAILY_LIMIT} generations. Upgrade to Pro!`,
        remaining: 0,
      });
    }

    // Store info in request for use in route
    req.isSubscribed = false;
    req.generationCount = generationCount;
    req.remaining = DAILY_LIMIT - generationCount;

    next();
  } catch (error) {
    console.error('Error checking generation limit:', error);
    // Fail secure: don't let them through if we can't verify
    return res.status(500).json({
      error: 'Failed to verify generation limit',
    });
  }
};

/**
 * Middleware to record a generation after successful creation
 * Call this AFTER the image is successfully generated
 */
export const recordGeneration = async (req, res, next) => {
  try {
    const userId = req.body.userId;

    if (userId && !req.isSubscribed) {
      // Only record for free users (subscribers have unlimited)
      // This is called after successful generation
      // We don't increment here - do it in the route after success
      req.shouldRecordGeneration = true;
    }

    next();
  } catch (error) {
    console.error('Error in recordGeneration middleware:', error);
    next();
  }
};