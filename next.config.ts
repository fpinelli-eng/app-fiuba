import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Las secciones del menú se precargan enteras (prefetch del Header). Se reusan hasta 60 s;
    // después se vuelven a pedir. Guardar algo refresca antes (router.refresh / revalidatePath).
    staleTimes: { static: 60 },
  },
};

export default nextConfig;
