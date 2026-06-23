import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  async redirects() {
    return [
      // Rota antiga /dashboard foi renomeada para /ct-e (commit f869fd4)
      {
        source: '/dashboard',
        destination: '/ct-e',
        permanent: true,
      },
      {
        source: '/dashboard/:path*',
        destination: '/ct-e/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;