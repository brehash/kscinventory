import { defineConfig } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: {
    preset: 'minimal'
  },
  preset: {
    maskable: {
      padding: 0.1,
    },
    apple: {
      padding: 0.1,
    },
  },
  images: [
    {
      src: 'src/assets/inventory-icon.svg',
      sizes: [64, 192, 512],
      type: 'image/png',
      formats: ['png']
    },
    {
      src: 'src/assets/inventory-icon.svg',
      sizes: [512],
      type: 'image/png',
      name: 'maskable-icon',
      purpose: 'maskable'
    },
    {
      src: 'src/assets/inventory-icon.svg',
      sizes: [180],
      type: 'image/png',
      name: 'apple-touch-icon',
      formats: ['png'],
    },
  ]
});