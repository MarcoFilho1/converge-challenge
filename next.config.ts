import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Em desenvolvimento, o Next só aceita pedidos vindos de localhost. Pelo Funnel do Tailscale (demo no celular)
  // a página chegava mas o React não ligava: nenhum botão respondia. Libera o endereço público e o 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1", "**.ts.net", ...(process.env.PUBLIC_APP_URL ? [new URL(process.env.PUBLIC_APP_URL).hostname] : [])],
  // data/ guarda gravações da pessoa e cache de voz em tempo de execução: nunca copiar para o pacote do build/deploy
  outputFileTracingExcludes: { "*": ["./data/**/*"] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
