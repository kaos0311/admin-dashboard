import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  allowedDevOrigins: ["app.advhomemed.com"],

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
