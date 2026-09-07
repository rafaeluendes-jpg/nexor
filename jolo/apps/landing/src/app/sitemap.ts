import type { MetadataRoute } from 'next';

const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: `${site}/politica-de-privacidade`, lastModified: new Date(), priority: 0.3 },
    { url: `${site}/termos`, lastModified: new Date(), priority: 0.3 },
  ];
}
