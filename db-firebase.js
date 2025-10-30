import admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Get today's generation count for a user
 * Automatically resets count if it's a new day
 * @param {string} userId - The user's ID
 * @returns {number} - Number of generations today
 */
export const getTodayGenerationCount = async (userId) => {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return 0;
    }

    const data = userDoc.data();
    const today = new Date().toDateString();

    // Reset count if it's a new day
    if (data.generationDate !== today) {
      await userRef.update({
        generationCount: 0,
        generationDate: today,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
      return 0;
    }

    return data.generationCount || 0;
  } catch (error) {
    console.error('Error getting generation count:', error);
    return 0;
  }
};

/**
 * Increment user's daily generation count
 * @param {string} userId - The user's ID
 */
export const incrementGenerationCount = async (userId) => {
  try {
    const userRef = db.collection('users').doc(userId);
    const today = new Date().toDateString();

    const userDoc = await userRef.get();
    const currentCount = userDoc.exists ? (userDoc.data().generationCount || 0) : 0;

    await userRef.set(
      {
        generationCount: currentCount + 1,
        generationDate: today,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error incrementing generation count:', error);
    throw error;
  }
};

/**
 * Get remaining generations for a user (only for free users)
 * @param {string} userId - The user's ID
 * @param {boolean} isSubscribed - Whether user is subscribed
 * @returns {number} - Remaining generations (Infinity for subscribers)
 */
export const getRemainingGenerations = async (userId, isSubscribed) => {
  if (isSubscribed) return Infinity;

  const count = await getTodayGenerationCount(userId);
  const DAILY_LIMIT = 5;
  return Math.max(0, DAILY_LIMIT - count);
};

export { db };