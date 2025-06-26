/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['cdn.discordapp.com', 'localhost'],
  },
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    API_URL: process.env.API_URL || 'http://localhost:3000',
    DEV_MODE: process.env.DEV_MODE || 'false',
  },
}

module.exports = nextConfig
