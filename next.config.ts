import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Las secciones del menú se precargan enteras (prefetch del Header) y se reusan hasta 10 min.
    // No llegan a vencer: el Header las renueva cada 4 min, y guardar algo las refresca al
    // instante (router.refresh / revalidatePath).
    staleTimes: { static: 600 },
  },
};

export default nextConfig;
