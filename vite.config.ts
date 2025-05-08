import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    target: 'esnext', // Ensure the build target supports top-level await
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'), // Root index.html
        bim2gis: resolve(__dirname, 'src/BIM2GIS/index.html'),
        cesium: resolve(__dirname, 'src/Cesium/index.html'),
        leaflet: resolve(__dirname, 'src/Leaflet/index.html'),
        mapbox: resolve(__dirname, 'src/Mapbox/index.html'),
        maplibre: resolve(__dirname, 'src/Maplibre/index.html'),
        maplibreThree: resolve(__dirname, 'src/Maplibre+Three/index.html'),
        three: resolve(__dirname, 'src/Three/index.html'),
        bim: resolve(__dirname, 'src/BIM/index.html'),
      },
    },
  },
  esbuild: {
    target: 'esnext', // Use a modern target that supports top-level await
  },
  base: '/bim2gis/', // Set the base path for the project
});
