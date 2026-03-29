// Mock authentication service for development
// This bypasses Supabase and provides simple local authentication

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'patient' | 'doctor';
  avatar?: string;
  specialization?: string;
  licenseNumber?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
  joinDate: string;
}

// Mock users storage (in real app, this would be in a database)
const mockUsers: User[] = [
  {
    id: '1',
    email: 'patient@test.com',
    name: 'John Patient',
    role: 'patient',
    phoneNumber: '+1234567890',
    dateOfBirth: '1990-01-01',
    joinDate: '2024-01-01'
  },
  {
    id: '2',
    email: 'doctor@test.com',
    name: 'Dr. Smith',
    role: 'doctor',
    specialization: 'Neurology',
    licenseNumber: 'PMDC12345',
    phoneNumber: '+1234567891',
    joinDate: '2024-01-01'
  }
];

// Mock authentication functions
export const mockLogin = async (email: string, password: string, role: 'patient' | 'doctor'): Promise<User | null> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simple password check (in real app, this would be hashed)
  if (password !== 'password123') {
    return null;
  }
  
  const user = mockUsers.find(u => u.email === email && u.role === role);
  return user || null;
};

export const mockSignup = async (userData: Omit<User, 'id' | 'joinDate'>, password: string): Promise<User | null> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Check if user already exists
  const existingUser = mockUsers.find(u => u.email === userData.email);
  if (existingUser) {
    return null;
  }
  
  // Create new user
  const newUser: User = {
    ...userData,
    id: (mockUsers.length + 1).toString(),
    joinDate: new Date().toISOString().split('T')[0]
  };
  
  mockUsers.push(newUser);
  return newUser;
};

export const mockLogout = async (): Promise<void> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  // In real app, this would clear server-side session
};

