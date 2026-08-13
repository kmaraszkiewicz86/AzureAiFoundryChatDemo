import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Proxy both SignalR negotiation and WebSocket traffic to the local ASP.NET Core API.
  server: {
    proxy: {
      '/hubs': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
})
