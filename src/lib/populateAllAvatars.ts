import { supabase } from './supabase';

// Avatar URLs
const FEMALE_AVATAR = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face';
const MALE_AVATAR = 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face';

/**
 * Determine the appropriate avatar URL based on user's gender
 */
function getAvatarUrl(gender?: string | null): string {
  const userGender = gender?.toLowerCase();

  // Check gender field - female gets female avatar, male gets male avatar
  if (userGender === 'female' || userGender === 'f') {
    return FEMALE_AVATAR;
  }
  
  // Default to male avatar (for male, null, or undefined)
  return MALE_AVATAR;
}

/**
 * Populate avatar URLs for all users in the database
 * This function will update users who have empty/null avatar_url
 * @returns Promise with success status and update count
 */
export async function populateAllAvatars(): Promise<{ 
  success: boolean; 
  message: string; 
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updatedCount = 0;

  try {
    console.log('🔄 Starting to populate avatar URLs for all users...');

    // Fetch all users
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, name, gender, avatar_url, role')
      .is('avatar_url', null);

    if (fetchError) {
      return {
        success: false,
        message: `Error fetching users: ${fetchError.message}`,
        updated: 0,
        errors: [fetchError.message]
      };
    }

    if (!users || users.length === 0) {
      return {
        success: true,
        message: 'No users found with empty avatar URLs',
        updated: 0,
        errors: []
      };
    }

    console.log(`📋 Found ${users.length} users without avatar URLs`);

    // Update each user
    for (const user of users) {
      try {
        const avatarUrl = getAvatarUrl(user.gender);
        
        const { data: updatedData, error: updateError } = await supabase
          .from('users')
          .update({ avatar_url: avatarUrl })
          .eq('id', user.id)
          .select();

        if (updateError) {
          const errorMsg = `Failed to update ${user.name} (${user.id}): ${updateError.message}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        } else if (!updatedData || updatedData.length === 0) {
          // RLS might have blocked the update
          const errorMsg = `Update blocked for ${user.name} (${user.id}): RLS policy may be preventing update`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        } else {
          updatedCount++;
          const genderInfo = user.gender ? ` (${user.gender})` : ' (no gender set)';
          console.log(`✅ Updated avatar for ${user.name}${genderInfo} - ${user.role}`);
        }
      } catch (error: any) {
        const errorMsg = `Error updating ${user.name}: ${error.message}`;
        console.error('❌', errorMsg);
        errors.push(errorMsg);
      }
    }

    const message = `Successfully updated ${updatedCount} out of ${users.length} users`;
    console.log(`✅ ${message}`);

    return {
      success: errors.length === 0,
      message,
      updated: updatedCount,
      errors
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Unexpected error: ${error.message}`,
      updated: updatedCount,
      errors: [error.message]
    };
  }
}

/**
 * Populate avatar URLs for all users (including those with existing avatars)
 * This will overwrite existing avatar URLs
 */
export async function populateAllAvatarsForce(): Promise<{ 
  success: boolean; 
  message: string; 
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updatedCount = 0;

  try {
    console.log('🔄 Starting to populate avatar URLs for ALL users (force mode)...');

    // Fetch all users
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, name, gender, avatar_url, role');

    if (fetchError) {
      return {
        success: false,
        message: `Error fetching users: ${fetchError.message}`,
        updated: 0,
        errors: [fetchError.message]
      };
    }

    if (!users || users.length === 0) {
      return {
        success: true,
        message: 'No users found',
        updated: 0,
        errors: []
      };
    }

    console.log(`📋 Found ${users.length} users to update`);

    // Update each user
    for (const user of users) {
      try {
        const avatarUrl = getAvatarUrl(user.gender);
        
        const { data: updatedData, error: updateError } = await supabase
          .from('users')
          .update({ avatar_url: avatarUrl })
          .eq('id', user.id)
          .select();

        if (updateError) {
          const errorMsg = `Failed to update ${user.name} (${user.id}): ${updateError.message}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        } else if (!updatedData || updatedData.length === 0) {
          // RLS might have blocked the update
          const errorMsg = `Update blocked for ${user.name} (${user.id}): RLS policy may be preventing update`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
        } else {
          updatedCount++;
          const genderInfo = user.gender ? ` (${user.gender})` : ' (no gender set)';
          console.log(`✅ Updated avatar for ${user.name}${genderInfo} - ${user.role}`);
        }
      } catch (error: any) {
        const errorMsg = `Error updating ${user.name}: ${error.message}`;
        console.error('❌', errorMsg);
        errors.push(errorMsg);
      }
    }

    const message = `Successfully updated ${updatedCount} out of ${users.length} users`;
    console.log(`✅ ${message}`);

    return {
      success: errors.length === 0,
      message,
      updated: updatedCount,
      errors
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Unexpected error: ${error.message}`,
      updated: updatedCount,
      errors: [error.message]
    };
  }
}

