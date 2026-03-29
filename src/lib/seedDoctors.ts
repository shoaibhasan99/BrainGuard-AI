import { supabase } from './supabase';

// Pakistani brain specialists data to seed into database
export const pakistaniDoctorsData = [
  {
    id: '550e8400-e29b-41d4-a716-446655440011',
    name: 'Dr. Ahmed Hassan',
    email: 'ahmed.hassan@brainguard.pk',
    specialization: 'Neurology',
    avatar_url: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face',
    license_number: 'PMDC-12345',
    experience_years: 15,
    consultation_fee: 2500,
    languages: ['English', 'Urdu'],
    qualifications: ['MBBS', 'FCPS Neurology', 'PhD Neuroscience'],
    hospital_affiliation: 'Aga Khan University Hospital, Karachi',
    is_verified: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440012',
    name: 'Dr. Muhammad Ali',
    email: 'muhammad.ali@brainguard.pk',
    specialization: 'Neurology',
    avatar_url: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&h=150&fit=crop&crop=face',
    license_number: 'PMDC-12346',
    experience_years: 12,
    consultation_fee: 2000,
    languages: ['English', 'Urdu'],
    qualifications: ['MBBS', 'FCPS Neurology', 'Board Certified'],
    hospital_affiliation: 'Shifa International Hospital, Islamabad',
    is_verified: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440013',
    name: 'Dr. Usman Sheikh',
    email: 'usman.sheikh@brainguard.pk',
    specialization: 'Neurology',
    avatar_url: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&h=150&fit=crop&crop=face',
    license_number: 'PMDC-12347',
    experience_years: 10,
    consultation_fee: 1800,
    languages: ['English', 'Urdu'],
    qualifications: ['MBBS', 'FCPS Neurology'],
    hospital_affiliation: 'Liaquat National Hospital, Karachi',
    is_verified: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440014',
    name: 'Dr. Hassan Raza',
    email: 'hassan.raza@brainguard.pk',
    specialization: 'Neurosurgery',
    avatar_url: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face',
    license_number: 'PMDC-12348',
    experience_years: 18,
    consultation_fee: 3000,
    languages: ['English', 'Urdu'],
    qualifications: ['MBBS', 'FCPS Neurosurgery', 'Fellowship in Brain Surgery'],
    hospital_affiliation: 'Aga Khan University Hospital, Karachi',
    is_verified: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440015',
    name: 'Dr. Fatima Khan',
    email: 'fatima.khan@brainguard.pk',
    specialization: 'Neurosurgery',
    avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face',
    license_number: 'PMDC-12349',
    experience_years: 15,
    consultation_fee: 2800,
    languages: ['English', 'Urdu', 'Punjabi'],
    qualifications: ['MBBS', 'FCPS Neurosurgery', 'Board Certified'],
    hospital_affiliation: 'Shifa International Hospital, Islamabad',
    is_verified: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440016',
    name: 'Dr. Ayesha Malik',
    email: 'ayesha.malik@brainguard.pk',
    specialization: 'Psychiatry',
    avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face',
    license_number: 'PMDC-12350',
    experience_years: 12,
    consultation_fee: 2200,
    languages: ['English', 'Urdu', 'Sindhi'],
    qualifications: ['MBBS', 'FCPS Psychiatry', 'Diploma in Mental Health'],
    hospital_affiliation: 'Jinnah Postgraduate Medical Centre, Karachi',
    is_verified: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440017',
    name: 'Dr. Zara Ahmed',
    email: 'zara.ahmed@brainguard.pk',
    specialization: 'Psychiatry',
    avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face',
    license_number: 'PMDC-12351',
    experience_years: 10,
    consultation_fee: 2000,
    languages: ['English', 'Urdu', 'Punjabi'],
    qualifications: ['MBBS', 'FCPS Psychiatry'],
    hospital_affiliation: 'Services Hospital, Lahore',
    is_verified: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440018',
    name: 'Dr. Saba Iqbal',
    email: 'saba.iqbal@brainguard.pk',
    specialization: 'Neuro-radiology',
    avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face',
    license_number: 'PMDC-12352',
    experience_years: 8,
    consultation_fee: 1800,
    languages: ['English', 'Urdu', 'Punjabi'],
    qualifications: ['MBBS', 'FCPS Radiology', 'Fellowship in Neuro-radiology'],
    hospital_affiliation: 'Shaukat Khanum Memorial Hospital, Lahore',
    is_verified: true,
  },
];

/**
 * Seed doctors into the database
 * This function creates user accounts and doctor profiles for the Pakistani brain specialists
 * Call this function once to populate the database with test doctors
 */
export async function seedDoctors(): Promise<{ success: boolean; message: string; created: number }> {
  let created = 0;
  const errors: string[] = [];

  for (const doctorData of pakistaniDoctorsData) {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', doctorData.email)
        .maybeSingle();

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        console.log(`✅ User already exists: ${doctorData.name}`);
      } else {
        // Create user account
        // Note: In production, you'd want to send an email invitation or use Supabase Auth
        const newUserId = crypto.randomUUID();
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            id: newUserId,
            name: doctorData.name,
            email: doctorData.email,
            role: 'doctor',
            avatar_url: doctorData.avatar_url,
            phone_number: '+92-300-0000000', // Placeholder
          })
          .select()
          .single();

        if (userError || !newUser) {
          errors.push(`Failed to create user for ${doctorData.name}: ${userError?.message}`);
          continue;
        }

        userId = newUser.id;
        console.log(`✅ Created user: ${doctorData.name}`);
      }

      // Check if doctor profile already exists
      const { data: existingDoctor } = await supabase
        .from('doctors')
        .select('id')
        .eq('id', doctorData.id)
        .maybeSingle();

      if (existingDoctor) {
        console.log(`✅ Doctor profile already exists: ${doctorData.name}`);
        continue;
      }

      // Create doctor profile
      const { error: doctorError } = await supabase
        .from('doctors')
        .insert({
          id: doctorData.id,
          user_id: userId,
          specialization: doctorData.specialization,
          license_number: doctorData.license_number,
          experience_years: doctorData.experience_years,
          consultation_fee: doctorData.consultation_fee,
          languages: doctorData.languages,
          qualifications: doctorData.qualifications,
          hospital_affiliation: doctorData.hospital_affiliation,
          is_verified: doctorData.is_verified,
        });

      if (doctorError) {
        errors.push(`Failed to create doctor profile for ${doctorData.name}: ${doctorError.message}`);
        continue;
      }

      created++;
      console.log(`✅ Created doctor profile: ${doctorData.name}`);
    } catch (error: any) {
      errors.push(`Error processing ${doctorData.name}: ${error.message}`);
    }
  }

  return {
    success: errors.length === 0,
    message: errors.length > 0 ? errors.join('; ') : `Successfully created ${created} doctor profiles`,
    created,
  };
}

