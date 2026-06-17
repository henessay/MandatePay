/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compile the workspace TS packages directly from source.
  transpilePackages: ["@mandatepay/shared", "@mandatepay/agent"],
  // Keep the T3N SDK (ships WASM) out of the bundler — load it from node_modules
  // at runtime on the server. The offline mock path never touches the WASM.
  serverExternalPackages: ["@terminal3/t3n-sdk"],
  webpack: (config) => {
    // Our workspace TS packages use explicit ".js" ESM specifiers that point at
    // ".ts" sources. Tell webpack a ".js" import may resolve to a ".ts" file.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
