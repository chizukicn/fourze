<template>
    <div class="px-4">
        <img :style="{ width: '120px' , height:'120px' }" src="/api/img/a.jpg" />
        <div class="flex space-x-4 py-2 items-center">
            <button class="bg-light-blue-400 text-white py-1 px-2 hover:bg-opacity-60"
                @click="fetchClick">Fetch</button>
            <button class="bg-light-blue-400 text-white py-1 px-2 hover:bg-opacity-60"
                @click="axiosClick">Axios</button>
            <button class="bg-light-blue-400 text-white py-1 px-2 hover:bg-opacity-60"
                @click="jqueryClick">JQuery</button>
        </div>

        <div v-show="time" class="text-lg text-light-blue-400">loading time:{{time}}ms</div>
        <div v-show="serverDelay> 0" class="text-lg text-light-blue-400">server delay:{{serverDelay}}ms</div>
        <div v-show="time - serverDelay> 0" class="text-lg text-light-blue-400">response time:{{time - serverDelay}}ms
        </div>


        <div v-show="endTime>0">
            <div v-for="item of list">
                {{item}}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useNow } from "@vueuse/core"
import axios from "axios"
import $ from "jquery"
import { computed, ref } from "vue"
export interface ResponseData {
    code: number
    data: any
    msg: string
}
const list = ref<any[]>([])


const startTime = ref(0)
const endTime = ref(0)

const now = useNow()

const serverDelay = ref(0)

const time = computed(() => {
    if (endTime.value === 0) {
        if (startTime.value == 0) {
            return 0
        }
        return now.value.getTime() - startTime.value
    }
    return endTime.value - startTime.value
})

function start() {
    startTime.value = Date.now()
    endTime.value = 0
}

function end() {
    endTime.value = Date.now()
}


async function fetchClick() {
    start()
    await fetch(`/api/search/${Math.floor(Math.random() * 9)}`, { method: "post", body: JSON.stringify({ phone: 2 }) })
        .then(r => {
            serverDelay.value = Number(r.headers.get("Fourze-Delay"))
            return r.json()
        })
        .then(r => r.data)
        .then(r => {
            list.value = Array.isArray(r) ? r : Object.entries(r)
        })
    end()
}

async function axiosClick() {
    start()
    await axios
        .post<ResponseData>(`/api/search/${Math.floor(Math.random() * 9)}`, { phone: 2 })
        .then(r => {
            serverDelay.value = Number(r.headers["fourze-delay"])
            return r.data.data
        })
        .then(r => (list.value = Array.isArray(r) ? r : Object.entries(r)))
    end()
}

function jqueryClick() {
    start()
    $.ajax({
        url: `/api/search/${Math.floor(Math.random() * 9)}`,
        method: "POST",
        data: JSON.stringify({ phone: 2 }),
        dataType: "json",
        contentType: "application/json",

        success(r) {
            r = r.data
            list.value = Array.isArray(r) ? r : Object.entries(r)
            end()
        },
        complete(r) {
            serverDelay.value = Number(r.getResponseHeader("Fourze-Delay"))
        },
        error(r) {
            console.error(r)
        }
    })

}

</script>
