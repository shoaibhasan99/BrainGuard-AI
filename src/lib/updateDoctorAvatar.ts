import { supabase } from './supabase';

/**
 * Update a doctor's avatar URL in the database
 * @param doctorName - The name of the doctor (e.g., "Dr. Sana Shahid")
 * @param newAvatarUrl - The new avatar URL (female doctor image)
 * @returns Promise with success status
 */
export async function updateDoctorAvatar(
  doctorName: string,
  newAvatarUrl: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Find the user by name
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('name', doctorName)
      .eq('role', 'doctor')
      .maybeSingle();

    if (userError) {
      return {
        success: false,
        message: `Error finding doctor: ${userError.message}`,
      };
    }

    if (!user) {
      return {
        success: false,
        message: `Doctor "${doctorName}" not found in database`,
      };
    }

    // Update the avatar URL
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: newAvatarUrl })
      .eq('id', user.id);

    if (updateError) {
      return {
        success: false,
        message: `Error updating avatar: ${updateError.message}`,
      };
    }

    return {
      success: true,
      message: `Successfully updated avatar for ${doctorName}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Unexpected error: ${error.message}`,
    };
  }
}

// Female doctor avatar URLs (Unsplash)
export const femaleDoctorAvatars = {
  default: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face',
  professional: 'https://images.unsplash.com/photo-1594824476966-48c8b964273f?w=150&h=150&fit=crop&crop=face',
  smiling: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=face',
  withGlasses: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face',
};














