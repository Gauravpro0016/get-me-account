import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/fulfillment";
import { Review } from "@/lib/products";

const REVIEWS_REDIS_KEY = "trinitymart_reviews";

const DEFAULT_REVIEWS: Review[] = [
  {
    id: "rev-global-1",
    userName: "Devansh K.",
    rating: 5,
    date: "1 day ago",
    comment: "Bought both the Netflix Key and Steam CS2 Prime ID. Both delivered to my screen in under 10 seconds. Trinitymart is 100% legit!",
    verified: true,
    productName: "Netflix & Steam ID Bundle",
  },
  {
    id: "rev-global-2",
    userName: "Sameer Verma",
    rating: 5,
    date: "3 days ago",
    comment: "Automated UPI delivery is the smoothest experience ever. No waiting for admin replies, no scam. 5/5 stars.",
    verified: true,
    productName: "Discord Nitro Booster ID",
  },
  {
    id: "rev-global-3",
    userName: "Karthik R.",
    rating: 5,
    date: "4 days ago",
    comment: "I had a minor question about my Steam credentials, joined their Discord and admin replied within 3 minutes. Exceptional support.",
    verified: true,
    productName: "Steam ID + Password",
  },
  {
    id: "rev-global-4",
    userName: "Arun Nair",
    rating: 4,
    date: "6 days ago",
    comment: "Windows 11 Pro key worked right away. No phone activation needed. Saved over 10,000 INR on the official price!",
    verified: true,
    productName: "Windows 11 Pro OEM Key",
  },
  {
    id: "rev-global-5",
    userName: "Rohan Mukherjee",
    rating: 5,
    date: "1 week ago",
    comment: "Xbox Game Pass Ultimate was redeemed instantly on my Microsoft account. Best price in India.",
    verified: true,
    productName: "Xbox Game Pass Ultimate",
  },
  {
    id: "rev-global-6",
    userName: "Tanmay B.",
    rating: 5,
    date: "2 weeks ago",
    comment: "Purchased GTA V Epic Account. Came with full original email access, changed password instantly. Smooth as butter.",
    verified: true,
    productName: "GTA V Premium Edition",
  },
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    let reviews: Review[] | null = null;
    try {
      reviews = await redis.get<Review[]>(REVIEWS_REDIS_KEY);
    } catch (e) {
      console.warn("Could not read from Redis, using defaults:", e);
    }

    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      reviews = DEFAULT_REVIEWS;
      try {
        await redis.set(REVIEWS_REDIS_KEY, reviews);
      } catch (e) {
        console.warn("Could not seed Redis reviews:", e);
      }
    }

    if (productId) {
      const filtered = reviews.filter((r) => r.productId === productId);
      return NextResponse.json({
        success: true,
        reviews: filtered,
        total: filtered.length,
      });
    }

    return NextResponse.json({
      success: true,
      reviews,
      total: reviews.length,
    });
  } catch (error) {
    console.error("Error in GET /api/reviews:", error);
    return NextResponse.json(
      { success: true, reviews: DEFAULT_REVIEWS, total: DEFAULT_REVIEWS.length },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userName = typeof body.userName === "string" ? body.userName.trim() : "";
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    const rawRating = Number(body.rating);
    const rating = Math.max(1, Math.min(5, Number.isInteger(rawRating) && rawRating > 0 ? rawRating : 5));
    const productName = typeof body.productName === "string" ? body.productName.trim() : undefined;
    const productId = typeof body.productId === "string" ? body.productId.trim() : undefined;

    if (!userName || !comment) {
      return NextResponse.json(
        { error: "Name and comment are required to submit a review." },
        { status: 400 }
      );
    }

    const newReview: Review = {
      id: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userName,
      rating,
      date: "Just now",
      comment,
      verified: true,
      productName: productName || "Trinitymart Verified Customer",
      productId,
    };

    let existing: Review[] = [];
    try {
      const raw = await redis.get<Review[]>(REVIEWS_REDIS_KEY);
      if (raw && Array.isArray(raw)) {
        existing = raw;
      } else {
        existing = DEFAULT_REVIEWS;
      }
    } catch {
      existing = DEFAULT_REVIEWS;
    }

    // Prepend newly submitted review
    const updated = [newReview, ...existing];

    try {
      await redis.set(REVIEWS_REDIS_KEY, updated);
    } catch (e) {
      console.error("Failed to write review to Redis:", e);
      return NextResponse.json(
        { error: "Database error while saving review." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Review successfully saved to Redis database!",
      review: newReview,
      reviews: updated,
    });
  } catch (err) {
    console.error("Error in POST /api/reviews:", err);
    return NextResponse.json(
      { error: "Internal server error while posting review." },
      { status: 500 }
    );
  }
}
