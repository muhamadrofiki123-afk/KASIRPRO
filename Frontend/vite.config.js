import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'KasirPRO',
        short_name: 'KasirPRO',
        description: 'Keuangan Rapi, Bisnis Lebih Pasti',
        theme_color: '#0D1B2A', // Warna hijau tema kita
        icons: [
        {
          src: 'Logo-PWA.png', // <--- Ubah jadi ini
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable' // Boleh ditambahkan juga
        },
        {
          src: 'Logo-PWA.png', // <--- Ubah jadi ini juga
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable' // Boleh ditambahkan juga
        }
      ]
      }
    })
  ]
})