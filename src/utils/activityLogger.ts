import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { User, ActivityType, ActivityEntityType } from '../types';

/**
 * Log an activity in the system
 * 
 * @param type - The type of activity (added, removed, updated, deleted)
 * @param entityType - The type of entity being acted upon (product, category, etc)
 * @param entityId - The ID of the entity
 * @param entityName - The name of the entity
 * @param user - The user performing the action
 * @param quantity - Optional quantity (for product quantity changes)
 * @returns The ID of the created activity log
 */
export const logActivity = async (
  type: ActivityType,
  entityType: ActivityEntityType,
  entityId: string,
  entityName: string,
  user: User,
  quantity?: number | null
): Promise<string | null> => {
  try {
    const activityData = {
      type,
      entityType,
      entityId,
      entityName,
      date: new Date(),
      userId: user.uid,
      userName: user.displayName || user.email || 'Unknown User',
    };
    
    // Only add quantity field if it's provided (not undefined or null)
    if (quantity !== undefined && quantity !== null) {
      Object.assign(activityData, { quantity });
    }

    const docRef = await addDoc(collection(db, 'activities'), activityData);
    return docRef.id;
  } catch (error) {
    console.error('Error logging activity:', error);
    return null;
  }
};