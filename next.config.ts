import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, `next dev` blocks /_next/* dev resources for any origin other than
  // localhost, so the app server-renders but never hydrates — every button is dead.
  // Needed to test on a phone over the LAN.
  allowedDevOrigins: ["127.0.0.1", "192.168.68.*"],
};

export default nextConfig;
