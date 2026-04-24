/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@vinculum/scene"],
  // Playwright and local tooling open the dev server via 127.0.0.1; Next 15+ warns on cross-origin HMR without this.
  allowedDevOrigins: ["127.0.0.1", "localhost"]
};

export default nextConfig;
