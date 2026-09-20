import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://gerkink.shop';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/auth/',
        '/account/',
        '/checkout/',
        '/cart/',
        '/thank-you/',
        '/review/',
        '/receipt/',
        '/r/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
