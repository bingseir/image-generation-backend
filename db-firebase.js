import admin from 'firebase-admin';

/**
 * Get today's generation count for a user
 */
export const getTodayGenerationCount = async (userId) => {
  try {
    console.log('📊 Getting generation count for:', userId);
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    console.log('📄 Document exists:', userDoc.exists);

    if (!userDoc.exists) {
      console.log('✅ No record found, returning 0');
      return 0;
    }

    const data = userDoc.data();
    const today = new Date().toDateString();

    console.log('📅 Today:', today, 'Stored date:', data.generationDate);

    if (data.generationDate !== today) {
      console.log('🔄 Date mismatch, resetting count');
      await userRef.update({
        generationCount: 0,
        generationDate: today,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
      return 0;
    }

    console.log('📈 Current count:', data.generationCount);
    return data.generationCount || 0;
  } catch (error) {
    console.error('❌ Error getting generation count:', error);
    return 0;
  }
};

/**
 * Increment user's daily generation count
 */
export const incrementGenerationCount = async (userId) => {
  try {
    console.log('⬆️ Incrementing count for:', userId);
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    const today = new Date().toDateString();

    const userDoc = await userRef.get();
    const currentCount = userDoc.exists ? (userDoc.data().generationCount || 0) : 0;

    console.log('💾 Saving new count:', currentCount + 1);

    await userRef.set(
      {
        generationCount: currentCount + 1,
        generationDate: today,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log('✅ Count incremented successfully');
  } catch (error) {
    console.error('❌ Error incrementing count:', error);
    throw error;
  }
};

/**
 * Get remaining generations for a user
 */
export const getRemainingGenerations = async (userId, isSubscribed) => {
  if (isSubscribed) return Infinity;

  const count = await getTodayGenerationCount(userId);
  const DAILY_LIMIT = 5;
  return Math.max(0, DAILY_LIMIT - count);
};