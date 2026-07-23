import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El backend es una funcion Python (api/index.py, Flask) — patron oficial
  // de Vercel para Next.js + Python:
  // - En desarrollo, /api/* se redirige al servidor Flask local (puerto 5328,
  //   lo arranca `npm run dev` junto con Next).
  // - En produccion (Vercel), /api/* lo atiende la funcion Python directamente.
  rewrites: async () => {
    return [
      {
        source: "/api/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://127.0.0.1:5328/api/:path*"
            : "/api/",
      },
    ];
  },
};

export default nextConfig;
