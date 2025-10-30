import axios from 'axios';

const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY;
const REVENUECAT_API_URL = 'https://api.revenuecat.com/v1';

/**
 * Verify if a user has an active subscription via RevenueCat
 * @param {string} userId - The user's ID (originalAppUserId from RevenueCat)
 * @returns {boolean} - True if user has active subscription
 */
export const isUserSubscribed = async (userId) => {
  try {
    if (!userId) return false;

    const response = await axios.get(
      `${REVENUECAT_API_URL}/subscribers/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${REVENUECAT_API_KEY}`,
        },
      }
    );

    // Check if user has any active entitlements
    const entitlements = response.data.subscriber.entitlements || {};
    const hasActiveEntitlement = Object.values(entitlements).some(
      (entitlement) => entitlement.expires_date === null || 
                       new Date(entitlement.expires_date) > new Date()
    );

    return hasActiveEntitlement;
  } catch (error) {
    console.error('Error verifying subscription:', error.message);
    // Fail open for security: if we can't verify, treat as free user
    return false;
  }
};