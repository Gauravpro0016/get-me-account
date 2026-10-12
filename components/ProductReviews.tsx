"use client";

import React, { useState, useEffect } from "react";
import { Star, CheckCircle, ThumbsUp, MessageSquarePlus, X, Database } from "lucide-react";
import { Review } from "@/lib/products";

interface ProductReviewsProps {
  initialReviews?: Review[];
  productTitle?: string;
  productId?: string;
}

const DEFAULT_COMMUNITY_REVIEWS: Review[] = [
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
];

export function ProductReviews({
  initialReviews,
  productTitle,
  productId,
}: ProductReviewsProps) {
  // If productId is provided, start with empty array until database response; else community defaults
  const [reviews, setReviews] = useState<Review[]>(
    initialReviews !== undefined
      ? initialReviews
      : productId
      ? []
      : DEFAULT_COMMUNITY_REVIEWS
  );
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load verified reviews from Redis database
  useEffect(() => {
    let isMounted = true;
    const fetchUrl = productId
      ? `/api/reviews?productId=${encodeURIComponent(productId)}`
      : "/api/reviews";

    fetch(fetchUrl)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && Array.isArray(data.reviews)) {
          setReviews(data.reviews);
        }
      })
      .catch((err) => console.warn("Reviews load warning:", err));

    return () => {
      isMounted = false;
    };
  }, [productId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !comment.trim()) return;

    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: name.trim(),
          comment: comment.trim(),
          rating,
          productName: productTitle || "Trinitymart Verified Customer",
          productId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.review) {
        setReviews((prev) => [data.review, ...prev.filter((r) => r.id !== data.review.id)]);
        setName("");
        setComment("");
        setRating(5);
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setShowModal(false);
        }, 1800);
      } else {
        setErrorMsg(data.error || "Failed to save review to database.");
      }
    } catch {
      setErrorMsg("Network error saving review to database. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const reviewCount = reviews.length;
  // If no reviews, rating is 5.0 by default per user requirement
  const avgRating =
    reviewCount > 0
      ? (
          reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) /
          reviewCount
        ).toFixed(1)
      : "5.0";

  // Calculate real rating distribution bars from actual database reviews
  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    if (reviewCount === 0) {
      return { stars, pct: stars === 5 ? "100%" : "0%" };
    }
    const count = reviews.filter((r) => Math.round(Number(r.rating) || 5) === stars).length;
    const percentage = Math.round((count / reviewCount) * 100);
    return { stars, pct: `${percentage}%` };
  });

  return (
    <section id="reviews" className="py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1 rounded-md bg-amber-400/10 text-amber-400 border border-amber-400/20">
                <Star className="w-4 h-4 fill-amber-400" />
              </span>
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-[#8083ff]">
                Verified Customer Feedback
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#dfe2ee] tracking-tight">
              Customer Reviews &amp; Telemetry Ratings
            </h2>
            <p className="text-xs sm:text-sm text-[#908fa0] mt-1">
              Read authentic feedback from verified gamers and digital license buyers.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-black text-xs sm:text-sm shadow-lg shadow-[#8083ff]/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer self-start md:self-auto"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>Write a Review</span>
          </button>
        </div>

        {/* Rating Breakdown Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 sm:p-8 rounded-2xl bg-[#181c24] border border-[#262a33] mb-8 shadow-xl">
          {/* Big Score */}
          <div className="flex flex-col items-center justify-center text-center p-4 border-b lg:border-b-0 lg:border-r border-[#262a33]">
            <span className="text-5xl sm:text-6xl font-black text-[#dfe2ee] font-mono">
              {avgRating}
            </span>
            <div className="flex items-center gap-1 text-amber-400 my-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-xs font-mono text-[#908fa0]">
              Based on {reviewCount} verified review{reviewCount === 1 ? "" : "s"}
            </span>
          </div>

          {/* Rating Bars */}
          <div className="col-span-1 lg:col-span-2 flex flex-col justify-center space-y-2.5 px-2 sm:px-6">
            {ratingDistribution.map(({ stars, pct }) => (
              <div key={stars} className="flex items-center gap-3 text-xs font-mono">
                <span className="w-12 text-[#c7c4d7] font-bold flex items-center gap-1">
                  <span>{stars}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-[#0f131c] overflow-hidden border border-[#262a33]">
                  <div
                    className="h-full bg-gradient-to-r from-[#8083ff] to-[#6366f1] rounded-full transition-all duration-500"
                    style={{ width: pct }}
                  />
                </div>
                <span className="w-10 text-right text-[#908fa0] font-mono font-bold">
                  {pct}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Reviews Grid or Clean Empty State */}
        {reviews.length === 0 ? (
          <div className="text-center py-12 p-8 rounded-2xl bg-[#181c24] border border-[#262a33] space-y-3 shadow-xl">
            <div className="flex justify-center text-amber-400 mb-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-6 h-6 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <h3 className="text-base font-bold text-[#dfe2ee]">
              No Reviews Yet (5.0 Initial Rating)
            </h3>
            <p className="text-xs text-[#908fa0] max-w-md mx-auto font-mono">
              Be the first customer to write a verified review for this product!
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] text-[#0d0096] hover:text-white font-black text-xs shadow-md shadow-[#8083ff]/20 hover:scale-105 transition-all cursor-pointer"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>Leave the First Review</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className="p-5 rounded-2xl bg-[#181c24] border border-[#262a33] shadow-md hover:border-[#31353e] hover:shadow-lg transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#dfe2ee]">
                        {rev.userName}
                      </span>
                      {rev.verified && (
                        <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-[#4edea3] bg-[#005236]/30 border border-[#4edea3]/30 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Verified Purchase
                        </span>
                      )}
                    </div>
                    {rev.productName && (
                      <span className="text-xs text-[#908fa0] mt-0.5 block font-mono">
                        Purchased: {rev.productName}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#908fa0] font-mono shrink-0">{rev.date}</span>
                </div>

                {/* Stars */}
                <div className="flex items-center gap-1 text-amber-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= rev.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-[#262a33]"
                      }`}
                    />
                  ))}
                </div>

                {/* Review Text */}
                <p className="text-xs sm:text-sm text-[#c7c4d7] leading-relaxed">
                  &ldquo;{rev.comment}&rdquo;
                </p>

                <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-[#908fa0] border-t border-[#262a33]">
                  <span>Instant automated delivery feedback</span>
                  <span className="flex items-center gap-1 text-[#8083ff]">
                    <ThumbsUp className="w-3 h-3" /> Verified Helpful
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Write a Review Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShowModal(false)}
            className="fixed inset-0 bg-black/85 backdrop-blur-md"
          />

          <div className="relative w-full max-w-md bg-[#181c24] rounded-2xl p-6 sm:p-8 shadow-2xl border border-[#262a33] z-10 animate-in fade-in zoom-in-95 text-[#dfe2ee]">
            <div className="flex items-center justify-between pb-4 border-b border-[#262a33]">
              <div>
                <h3 className="text-lg font-bold text-[#dfe2ee]">
                  Share Your Experience
                </h3>
                <p className="font-mono text-xs text-[#908fa0] mt-0.5">
                  Verified rating for Trinitymart marketplace
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-[#908fa0] hover:text-[#dfe2ee] hover:bg-[#262a33] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitted ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle className="w-12 h-12 text-[#4edea3] mx-auto animate-bounce" />
                <h4 className="text-base font-bold text-[#dfe2ee]">
                  Review Saved to Database!
                </h4>
                <p className="text-xs text-[#908fa0] font-mono">
                  Your verified review has been stored in Redis and is now live across Trinitymart.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4 pt-4">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-[#93000a]/20 border border-[#ffb4ab]/30 text-xs text-[#ffb4ab] font-mono font-semibold">
                    ⚠️ {errorMsg}
                  </div>
                )}

                {/* Rating selection */}
                <div>
                  <label className="block text-xs font-bold font-mono text-[#c7c4d7] mb-1.5">
                    Your Rating
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => setRating(s)}
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 text-[#908fa0] hover:scale-110 transition-all cursor-pointer"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            s <= (hoverRating || rating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-[#262a33]"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold font-mono text-[#c7c4d7] mb-1">
                    Your Name / Gamertag
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul, ShadowSniper"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold font-mono text-[#c7c4d7] mb-1">
                    Review Description
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="How was the delivery speed and product quality?"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f131c] border border-[#262a33] text-xs text-[#dfe2ee] placeholder-[#908fa0]/60 focus:outline-none focus:border-[#8083ff] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-[#8083ff] hover:bg-[#6366f1] disabled:opacity-50 text-[#0d0096] hover:text-white font-black text-xs shadow-lg shadow-[#8083ff]/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#0d0096] border-t-transparent rounded-full animate-spin" />
                      <span className="font-mono">Saving to Redis Database…</span>
                    </>
                  ) : (
                    <span>Submit Verified Review</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

