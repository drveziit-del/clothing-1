import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
      { protocol: "https", hostname: "print-on-demand-895b7.firebasestorage.app", pathname: "/**" },
      { protocol: "https", hostname: "*.firebasestorage.app", pathname: "/**" },
      { protocol: "https", hostname: "storage.googleapis.com", pathname: "/**" },
      { protocol: "https", hostname: "images-api.printify.com", pathname: "/**" },
      { protocol: "https", hostname: "cdn.printify.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "*.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "commondatastorage.googleapis.com", pathname: "/**" },
    ],
  },
  async headers() {
    const scriptCSP = "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com https://*.razorpay.com https://apis.google.com https://www.paypal.com https://*.paypal.com https://*.paypalobjects.com";

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptCSP,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://images-api.printify.com https://storage.googleapis.com https://cdn.printify.com https://firebasestorage.googleapis.com https://*.firebasestorage.app https://lh3.googleusercontent.com https://*.googleusercontent.com https://*.paypalobjects.com https://*.paypal.com",
              "media-src 'self' blob: https://firebasestorage.googleapis.com https://commondatastorage.googleapis.com",
              "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://api.razorpay.com https://*.razorpay.com https://api.printify.com https://open.er-api.com wss://*.firebaseio.com https://*.paypal.com https://*.paypalobjects.com",
              "frame-src https://checkout.razorpay.com https://*.razorpay.com https://accounts.google.com https://*.firebaseapp.com https://apis.google.com https://gerkink.shop https://*.gerkink.shop https://*.paypal.com https://*.paypalobjects.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://print-on-demand-895b7.firebaseapp.com/__/auth/:path*",
      },
    ];
  },
};

export default nextConfig;
