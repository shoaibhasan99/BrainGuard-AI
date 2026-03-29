import { loadStripe, Stripe } from '@stripe/stripe-js';
import { supabase } from './supabase';

// Initialize Stripe with your publishable key
// Get from environment variable or Supabase config
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

if (!STRIPE_PUBLISHABLE_KEY) {
  console.warn('Stripe publishable key not found. Please set VITE_STRIPE_PUBLISHABLE_KEY in your .env file');
}

const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

export const getStripe = (): Promise<Stripe | null> => {
  return stripePromise;
};

import { supabase } from './supabase';

// Create payment intent via Supabase Edge Function
export const createPaymentIntent = async (amount: number, currency: string = 'pkr', metadata?: Record<string, string>) => {
  try {
    const { data, error } = await supabase.functions.invoke('create-payment-intent', {
      body: {
        amount: Math.round(amount * 100), // Convert PKR to paisa
        currency: currency.toLowerCase(),
        metadata: metadata || {},
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to create payment intent');
    }

    if (!data?.clientSecret) {
      throw new Error('No client secret returned');
    }

    return data.clientSecret;
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

