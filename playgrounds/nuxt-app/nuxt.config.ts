// https://v3.nuxtjs.org/api/configuration/nuxt.config
import fourzeModule from "@fourze/nuxt"
import jsx from "@vitejs/plugin-vue-jsx"

export default defineNuxtConfig({
    modules: [fourzeModule, "nuxt-windicss"],
    fourze: {
        base: "/api",
        delay: "200-500"
    },
    vite: {
        plugins: [jsx()]
    }
})
