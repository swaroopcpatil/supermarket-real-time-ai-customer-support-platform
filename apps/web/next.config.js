/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // Requests are proxied by the Next server.  Using a configurable
        // internal address keeps both `npm run dev` and Docker Compose working.
        destination: `${process.env.API_GATEWAY_INTERNAL_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
