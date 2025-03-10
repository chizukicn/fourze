import { createApp } from "vue";
import { createRouter, createWebHistory, RouterView } from "vue-router";
import "uno.css";

createApp(RouterView)
  .use(
    createRouter({
      history: createWebHistory(import.meta.env.BASE_URL),
      routes: [
        {
          path: "/",
          redirect: "/home"
        },
        {
          path: "/home",
          component: () => import("./app.vue")
        },
        {
          path: "/fallback",
          component: () => import("./app.vue")
        }
      ]
    })
  )
  .mount("#app");
