/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable experimental features for better performance
    experimental: {
        optimizePackageImports: ['@supabase/supabase-js'],
    },
};

module.exports = nextConfig;
