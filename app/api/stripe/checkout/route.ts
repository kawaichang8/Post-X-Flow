import { NextRequest, NextResponse } from "next/server"
import { createServerClient, getSupabaseClient } from "@/lib/supabase"

// Stripe checkout session creation
// Note: Requires STRIPE_SECRET_KEY and STRIPE_PRICE_ID environment variables.
// User is authenticated via access_token sent from the client (cookie-less API route).

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    const stripePriceId = process.env.STRIPE_PRICE_ID

    if (!stripeSecretKey || !stripePriceId) {
      return NextResponse.json(
        { error: "Stripe is not configured. Please set STRIPE_SECRET_KEY and STRIPE_PRICE_ID." },
        { status: 500 }
      )
    }

    // Get access_token from body (client sends session.access_token)
    const body = await request.json().catch(() => ({}))
    const accessToken = (body?.access_token ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")) as string | undefined

    if (!accessToken?.trim()) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in again." },
        { status: 401 }
      )
    }

    // Validate JWT and get user with anon client
    const anon = getSupabaseClient()
    const { data: { user }, error: authError } = await anon.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Session may have expired. Please sign in again." },
        { status: 401 }
      )
    }

    const supabase = createServerClient()
    
    // Get or create Stripe customer
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single()
    
    // Import Stripe dynamically to avoid issues if not installed
    const Stripe = (await import("stripe")).default
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-01-28.clover",
    })
    
    let customerId = subscription?.stripe_customer_id
    
    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id
      
      // Save customer ID
      await supabase
        .from("user_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id)
    }
    
    // Get the origin for redirect URLs
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/dashboard?upgrade=success`,
      cancel_url: `${origin}/dashboard?upgrade=cancelled`,
      metadata: {
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
      },
      allow_promotion_codes: true,
    })
    
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Stripe checkout error:", error)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}
