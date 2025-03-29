/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Configure rendering mode
  output: 'standalone', // Changed from 'server' to 'standalone'
  experimental: {
    // This prevents issues with getServerSession and headers
    serverComponentsExternalPackages: ['mongoose'],
  },
};

module.exports = nextConfig;
