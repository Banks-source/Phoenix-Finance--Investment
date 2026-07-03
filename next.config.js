/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't reuse the client-side Router Cache for dynamic pages: every tab
  // switch refetches, so approvals show up on Overview/Categories immediately.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};
module.exports = nextConfig;
