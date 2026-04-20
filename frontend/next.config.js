// `NEXT_PUBLIC_API_BASE_URL` is evaluated at build time because Next
// inlines `NEXT_PUBLIC_*` into the client bundle. We intentionally do
// NOT fall back to `http://localhost:8000/api` in production builds:
// that fallback would bake a private-network URL into a hosted site,
// which Chrome then surfaces as a Private Network Access prompt.
//
// If the env var is not set we fall back to an empty string so the
// runtime API client emits an explicit, visible error rather than
// silently pointing at localhost.

const isProd = process.env.NODE_ENV === "production";
const explicit = process.env.NEXT_PUBLIC_API_BASE_URL;
const fallback = isProd ? "" : "http://localhost:8000/api";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: explicit || fallback,
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE || "",
  },
};

module.exports = nextConfig;
