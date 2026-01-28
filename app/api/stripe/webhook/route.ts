import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

// Stripe Webhook Handler
// Handles subscription lifecycle events

export async function POST(request: NextRequest) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    
    if (!stripeSecretKey) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
    }
    
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")
    
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }
    
    // Import Stripe
    const Stripe = (await import("stripe")).default
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-01-28.clover",
    })
    
    let event
    
    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      } catch (err) {
        console.error("Webhook signature verification failed:", err)
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
      }
    } else {
      // Without webhook secret, just parse the event (not recommended for production)
      event = JSON.parse(body)
    }
    
    const supabase = createServerClient()
    
    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object
        const userId = session.metadata?.user_id
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        
        if (userId) {
          await supabase
            .from("user_subscriptions")
            .update({
              subscription_status: "pro",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_started_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
          
          console.log(`[Stripe] User ${userId} upgraded to Pro`)
        }
        break
      }
      
      case "customer.subscription.updated": {
        const subscription = event.data.object
        const subscriptionId = subscription.id
        const status = subscription.status
        
        // Find user by subscription ID
        const { data: userSub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single()
        
        if (userSub) {
          let newStatus: "pro" | "cancelled" | "free" = "free"
          
          if (status === "active" || status === "trialing") {
            newStatus = "pro"
          } else if (status === "canceled" || status === "unpaid") {
            newStatus = "cancelled"
          }
          
          await supabase
            .from("user_subscriptions")
            .update({
              subscription_status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userSub.user_id)
          
          console.log(`[Stripe] Subscription ${subscriptionId} status: ${newStatus}`)
        }
        break
      }
      
      case "customer.subscription.deleted": {
        const subscription = event.data.object
        const subscriptionId = subscription.id
        
        // Find user by subscription ID
        const { data: userSub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single()
        
        if (userSub) {
          await supabase
            .from("user_subscriptions")
            .update({
              subscription_status: "cancelled",
              subscription_ends_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userSub.user_id)
          
          console.log(`[Stripe] Subscription ${subscriptionId} cancelled`)
        }
        break
      }
      
      case "invoice.payment_failed": {
        const invoice = event.data.object
        const customerId = invoice.customer as string
        
        // Find user by customer ID
        const { data: userSub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single()
        
        if (userSub) {
          console.log(`[Stripe] Payment failed for user ${userSub.user_id}`)
          // Could send notification or downgrade after grace period
        }
        break
      }
      
      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`)
    }
    
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
