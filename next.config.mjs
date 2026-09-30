import dns from "node:dns";

// On some networks (common on Windows), Node's default DNS resolution
// order tries the IPv6 address first even when the local network has no
// working IPv6 route, causing every outbound fetch() (Meta Graph API,
// OpenAI, n8n) to hang for ~10s before failing with
// UND_ERR_CONNECT_TIMEOUT — even though the host is reachable over IPv4
// (as a plain `curl` from the same machine confirms). Forcing IPv4-first
// resolution avoids that wait entirely. This must run before any fetch()
// call in the process, so it's set here at config-load time.
dns.setDefaultResultOrder("ipv4first");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { allowedOrigins: ["*"] } }
};
export default nextConfig;
