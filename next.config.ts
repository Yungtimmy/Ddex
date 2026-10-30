import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["ws"],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        net: false,
        tls: false,
        bufferutil: false,
        "utf-8-validate": false,
      }
      config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^ws$/ }))
    }
    return config
  },
}

export default nextConfig
