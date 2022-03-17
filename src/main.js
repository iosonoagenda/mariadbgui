import {createApp} from 'vue'
import App from './App.vue'
import {createRouter, createWebHashHistory} from "vue-router";
import HomeComponent from "@/components/HomeComponent";

const routes = [
    {
        path: '/',
        component: HomeComponent
    }
];

const router = createRouter({
    history: createWebHashHistory(),
    routes
});

const app = createApp(App);

app.use(router);

app.mount('#app');
