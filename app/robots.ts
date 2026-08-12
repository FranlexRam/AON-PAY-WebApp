import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'], // Opcional: evita que los buscadores indexen directamente endpoints de la API
    },
    sitemap: 'https://www.aonpayapp.com/sitemap.xml',
  };
}