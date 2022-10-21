import fourze from "@fourze/vite"
import vue from "@vitejs/plugin-vue"
import jsx from "@vitejs/plugin-vue-jsx"
import visualizer from "rollup-plugin-visualizer"
import uncomponents from "unplugin-vue-components"

import { defineConfig, Plugin } from "vite"
import windicss from "vite-plugin-windicss"

export default defineConfig({
    server: {
        port: 8000,
        host: "0.0.0.0",
        fs: {
            strict: false
        }
    },
    plugins: [
        vue(),
        jsx(),
        windicss(),
        fourze({
            base: "/api",
            filePattern: [".ts$", ".js$"],
            hmr: true,
            mock: true,
            delay: "200-500"
        }),
        visualizer({
            open: false,
            gzipSize: true,
            brotliSize: true
        }) as Plugin,
        uncomponents.vite({
            resolvers: []
        })
    ]
})
