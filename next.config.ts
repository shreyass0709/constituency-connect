import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Complaint photos and public-site media all live in one Cloudinary account.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default nextConfig;
