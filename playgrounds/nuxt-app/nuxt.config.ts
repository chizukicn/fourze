// https://v3.nuxtjs.org/api/configuration/nuxt.config
import jsx from "@vitejs/plugin-vue-jsx";

export default defineNuxtConfig({
  modules: ["@fourze/nuxt", "@unocss/nuxt"],
  vite: {
    plugins: [jsx()]
  }
});
