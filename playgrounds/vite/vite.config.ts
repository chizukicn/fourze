import fourze from "@fourze/vite"
import vue from "@vitejs/plugin-vue"
import jsx from "@vitejs/plugin-vue-jsx"
import path from "path"
import { defineConfig } from "vite"

export default defineConfig({
    server: {
        port: 8000,
        host: "0.0.0.0"
    },
    plugins: [
        vue(),
        jsx(),
        fourze({
            base: "/api",
            dir: path.resolve(__dirname, "mock"),
            filePattern: [".ts$", ".js$"],
            hmr: true,
            mock: true,
            logLevel: "info"
        })
    ]
})
