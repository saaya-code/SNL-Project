/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['cdn.discordapp.com', 'localhost'],
  },
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3001',
    API_URL: process.env.API_URL || 'http://localhost:3000',
    DEV_MODE: process.env.DEV_MODE || 'false',
  },
}

module.exports = nextConfig
