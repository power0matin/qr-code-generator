import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ModuQR — Advanced QR Studio',
    short_name: 'ModuQR',
    description: 'Privacy-first QR code generator, designer and scanner.',
    start_url: '/generator',
    display: 'standalone',
    background_color: '#0c0d10',
    theme_color: '#5b4cf0',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
