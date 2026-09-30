import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        platform: {
          whatsapp: "#25D366",
          messenger: "#0084FF",
          instagram: "#C13584",
          tiktok: "#010101"
        }
      }
    }
  },
  plugins: []
};
export default config;
