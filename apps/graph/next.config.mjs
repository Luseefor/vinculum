/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@vinculum/scene"],
  // Keep dev and production outputs separate to avoid chunk/runtime corruption
  // when `next dev` and `next build` are run in different terminals.
  distDir: process.env.NODE_ENV === "production" ? ".next" : ".next-dev"
};

export default nextConfig;
