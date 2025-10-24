"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export const Hero = () => (
  <section className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6">
    {/* Logo */}
    <img src="/logo.svg" alt="Pulltalk Logo" className="w-32 h-auto mx-auto mb-6" />

    {/* Title */}
    <motion.h1
      className="text-5xl md:text-6xl font-bold mb-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      🎥 Pulltalk
    </motion.h1>

    {/* Tagline */}
    <p className="text-xl text-gray-600 mb-8 max-w-2xl">
      Clarify code reviews in <span className="font-semibold text-gray-800">60 seconds</span> — bring voice, video, and visual context directly to your pull requests.
    </p>

    {/* CTA Buttons */}
    <div className="flex flex-col sm:flex-row justify-center gap-4">
      <a
        href="https://forms.gle/YOUR_WAITLIST_LINK"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-6 py-3 text-white text-lg font-medium hover:bg-gray-800 transition"
      >
        Join Waitlist <ArrowRight size={18} />
      </a>

      <a
        href="#how-it-works"
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-6 py-3 text-lg font-medium text-gray-700 hover:bg-gray-200 transition"
      >
        Watch Demo
      </a>
    </div>

    {/* Demo Video */}
    <div className="mt-10 w-full max-w-2xl">
      <video
        src="/demo.mp4"
        controls
        className="rounded-2xl shadow-lg w-full"
      />
    </div>
  </section>
);
