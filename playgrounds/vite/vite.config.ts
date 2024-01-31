import { resolve } from "node:path";
import fourze from "@fourze/vite";
import vue from "@vitejs/plugin-vue";
import jsx from "@vitejs/plugin-vue-jsx";
import visualizer from "rollup-plugin-visualizer";
import uncomponents from "unplugin-vue-components/vite";

import type { Plugin } from "vite";
import { defineConfig } from "vite";
import unocss from "unocss/vite";
import { alias } from "../../alias";

const aliasArray = [...Object.entries(alias).map(([key, value]) => {
  return {
    find: key,
    replacement: value
  };
})];

export default defineConfig({
  server: {
    port: 7609,
    host: "0.0.0.0",
    fs: {
      strict: false
    },
    proxy: {
      "/v2/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/v2\/api/, "")
      }
    }
  },
  resolve: {
    alias: [
      {
        find: "assets",
        replacement: resolve(__dirname, "./src/assets")
      },
      {
        find: "vue",
        replacement: "vue/dist/vue.esm-bundler.js" // compile template
      },
      ...aliasArray,
      {
        find: "@",
        replacement: resolve(__dirname, "./src")
      }
    ],
    extensions: [".ts", ".js"]
  },
  envPrefix: ["APP_"],
  plugins: [
    vue(),
    jsx(),
    unocss(),
    fourze({
      base: "/api",
      files: {
        include: ["*.ts", "*.js"]
      },
      hmr: true,
      mock: {
        enable: true,
        host: ["http://localhost:8080"]
      },
      delay: "200-500",
      logLevel: "debug"
    }),
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true
    }) as Plugin,
    uncomponents({
      resolvers: []
    })
  ]
});
