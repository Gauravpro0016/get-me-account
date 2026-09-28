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
              <span className="p-1 rounded-md bg-amber-500/10 text-amber-500">
                <Star className="w-4 h-4 fill-amber-500" />
              </span>
              <span className="text-xs uppercase font-extrabold tracking-widest text-cyan-500">
                Customer Testimonials
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Verified Buyer Reviews &amp; Ratings
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Read authentic feedback from verified gamers and digital buyers.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/35 hover:scale-105 active:scale-95 transition-all cursor-pointer self-start md:self-auto"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>Write a Review</span>
          </button>
        </div>

        {/* Rating Breakdown Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 sm:p-8 rounded-3xl bg-[#0a1120] dark:bg-[#0a1120] light:bg-white border border-cyan-500/20 mb-8 shadow-xl">
          {/* Big Score */}
          <div className="flex flex-col items-center justify-center text-center p-4 border-b lg:border-b-0 lg:border-r border-cyan-500/15">
            <span className="text-5xl sm:text-6xl font-black text-white dark:text-white light:text-slate-900">
              {avgRating}
            </span>
            <div className="flex items-center gap-1 text-amber-400 my-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-5 h-5 fill-amber-400" />
              ))}
            </div>
            <span className="text-xs font-bold text-slate-300">
              Based on {reviewCount} verified review{reviewCount === 1 ? "" : "s"}
            </span>
          </div>

          {/* Rating Bars */}
          <div className="col-span-1 lg:col-span-2 flex flex-col justify-center space-y-2.5 px-2 sm:px-6">
            {ratingDistribution.map(({ stars, pct }) => (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-12 text-slate-300 font-bold flex items-center gap-1">
                  <span>{stars}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </span>
                <div className="flex-1 h-2 rounded-full bg-black/50 overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                    style={{ width: pct }}
                  />
                </div>
                <span className="w-10 text-right text-slate-400 font-mono font-bold">
                  {pct}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Reviews Grid or Clean Empty State */}
        {reviews.length === 0 ? (
          <div className="text-center py-12 p-8 rounded-3xl bg-[#0a1120] border border-cyan-500/20 space-y-3 shadow-xl">
            <div className="flex justify-center text-amber-400 mb-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-6 h-6 fill-amber-400" />
              ))}
            </div>
            <h3 className="text-base font-extrabold text-white">
              No Reviews Yet (5.0 Initial Rating)
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Be the first customer to write a verified review for this product!
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-md shadow-cyan-500/20 hover:scale-105 transition-all cursor-pointer"
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
                className="p-5 rounded-2xl bg-[#0a1120] dark:bg-[#0a1120] light:bg-white border border-cyan-500/20 shadow-md hover:border-cyan-400/50 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white dark:text-white light:text-slate-900">
                        {rev.userName}
                      </span>
                      {rev.verified && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Verified Purchase
                        </span>
                      )}
                    </div>
                    {rev.productName && (
                      <span className="text-xs text-slate-400 mt-0.5 block">
                        Purchased: {rev.productName}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">{rev.date}</span>
                </div>

                {/* Stars */}
                <div className="flex items-center gap-1 text-amber-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= rev.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300 dark:text-slate-700"
                      }`}
                    />
                  ))}
                </div>

                {/* Review Text */}
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  &ldquo;{rev.comment}&rdquo;
                </p>

                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 dark:border-white/5">
                  <span>Instant automated delivery feedback</span>
                  <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                    <ThumbsUp className="w-3 h-3" /> Helpful
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
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-md bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-white/10 z-10 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Share Your Experience
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitted ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Review Saved to Database!
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your verified review has been stored in Redis and is now live across Trinitymart.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-4 pt-4">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-semibold">
                    ⚠️ {errorMsg}
                  </div>
                )}

                {/* Rating selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
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
                        className="p-1 text-slate-300 transition-colors cursor-pointer"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            s <= (hoverRating || rating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-300 dark:text-slate-600"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Name / Gamertag
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul, ShadowSniper"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Review Description
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="How was the delivery speed and product quality?"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Saving to Redis Database…</span>
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
