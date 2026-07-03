import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder_build_only', {
  apiVersion: '2026-05-27.dahlia',
})
