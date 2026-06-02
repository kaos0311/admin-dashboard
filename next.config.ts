import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.68.56",
  ],

  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    remotePatterns: [],
  },

  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
