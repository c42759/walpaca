import type { NextConfig } from "next";

const rawCors = process.env.CORS_DOMAINS || process.env.ALLOWED_DEV_ORIGINS || "";
const envOrigins = rawCors
  .split(",")
  .map((item) => item.trim().replace(/^https?:\/\//, ""))
  .filter(Boolean);

const devOrigins = new Set<string>([
  "localhost",
  "localhost:3000",
  "127.0.0.1",
  "127.0.0.1:3000",
]);

for (const origin of envOrigins) {
  devOrigins.add(origin);
  // If origin has port, also add without port
  if (origin.includes(":")) {
    devOrigins.add(origin.split(":")[0]);
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: Array.from(devOrigins),
};

export default nextConfig;
