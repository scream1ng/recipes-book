import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recipes Book",
    short_name: "Recipes Book",
    description: "Your recipes, priced.",
    start_url: "/recipes",
    display: "standalone",
    background_color: "#F6EFE9",
    theme_color: "#C9587A",
    icons: [
      { src: "/icons/icon-192.png?v=5", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png?v=5", sizes: "512x512", type: "image/png" },
    ],
  };
}
