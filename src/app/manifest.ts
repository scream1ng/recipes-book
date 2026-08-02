import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recipe Ledger",
    short_name: "Recipes",
    description: "Your recipes, priced.",
    start_url: "/order",
    display: "standalone",
    background_color: "#F6EFE9",
    theme_color: "#C9587A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
