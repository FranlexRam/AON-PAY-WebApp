import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://aonpayapp.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // Agrega aquí otras rutas públicas si existen
  ]
}