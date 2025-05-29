import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "u9zvekpkpxdgiv9o.public.blob.vercel-storage.com",
      },
    ],
    domains: ["localhost"],
  },
};

export default nextConfig;
