/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
      return [{ source: '/api/:path*', destination: 'http://retriever-api:8000/:path*' }];
    },
  };
  module.exports = nextConfig;
  