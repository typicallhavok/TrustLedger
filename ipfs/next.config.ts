import type { Configuration } from "webpack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config: Configuration) => {
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve?.fallback,
        electron: false,
        child_process: false,
        fs: false,
        net: false,
        tls: false,
      },
    };
    return config;
  },
};

export default nextConfig;
