<template>
    <div class="px-4">
        <div class=" font-bold py-4 text-2xl text-light-blue-400">Image Upload/Load</div>
        <div class="flex space-x-4 px-8 items-center">
            <img :style="{ width: '120px' , height:'120px' }" :src="avatarUrl" />
            <div>
                <button class="bg-light-blue-400 text-white py-1 px-2 hover:bg-opacity-60"
                    @click="upload">Upload</button>
            </div>
        </div>

        <div class=" font-bold py-4 text-2xl text-light-blue-400">XHR/FETCH</div>
        <div class="px-8">

            <div class="flex space-x-4 py-2 items-center">
                <button class="bg-light-blue-400 text-white py-1 px-2 hover:bg-opacity-60"
                    @click="handleFetch">Fetch</button>
                <button class="bg-light-blue-400 text-white py-1 px-2 hover:bg-opacity-60"
                    @click="handleAxios">Axios</button>
                <button class="bg-light-blue-400 text-white py-1 px-2 hover:bg-opacity-60"
                    @click="handleJQuery">JQuery</button>
            </div>
            <div class="flex space-x-4">


                <textarea readonly :value="JSON.stringify(result,null,4)" class="bg-gray-400 h-100 w-100"></textarea>
                <div>
                    <div v-show="time" class="text-lg text-light-blue-400">loading time:{{time}}ms</div>
                    <div v-show="serverDelay> 0" class="text-lg text-light-blue-400">server delay:{{serverDelay}}ms
                    </div>
                    <div v-show="time - serverDelay> 0" class="text-lg text-light-blue-400">response time:{{time -
                    serverDelay}}ms
                    </div>
                </div>

            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useNow } from "@vueuse/core"
import axios from "axios"
import $ from "jquery"
import { MaybeAsyncFunction } from "maybe-types"
import { computed, ref } from "vue"

export interface ResponseData {
    code: number
    data: any
    msg: string
}

const t = ref(0)

const avatarUrl = computed(() => {
    return "/api/img/avatar.jpg?t=" + t.value
})


function upload() {
    const file = document.createElement("input")
    file.type = "file"
    file.onchange = async (e) => {
        if (file.files) {
            const formData = new FormData()
            formData.append("file", file.files[0])
            formData.append("name", "avatar")
            const rs = await axios.post("/api/upload/avatar", formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            })
            t.value = new Date().getTime()
        }
    }
    file.click()
}


const result = ref<any>()


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

const recoding = (fn: MaybeAsyncFunction<void>) => {
    return async () => {
        start()
        try {
            await fn()
        } catch (error) {
            result.value = error
        }
        end()
    }
}

const handleFetch = recoding(async () => {
    result.value = await fetch(`/api/search/${Math.floor(Math.random() * 9)}`, { method: "post", body: JSON.stringify({ phone: 2 }) })
        .then(r => {
            serverDelay.value = Number(r.headers.get("Fourze-Delay"))
            return r.json()
        })
        .then(r => r.data)
})


const handleAxios = recoding(async () => {
    const rs = await axios.post(`/api/search/${Math.floor(Math.random() * 9)}`, { phone: 2 })
    serverDelay.value = Number(rs.headers["fourze-delay"])
    result.value = rs.data.data
})


const handleJQuery = recoding(async () => {
    await $.ajax({
        url: `/api/search/${Math.floor(Math.random() * 9)}`,
        type: "post",
        data: JSON.stringify({ phone: 2 }),
        contentType: "application/json",
        success: (data, status, jqXHR) => {
            serverDelay.value = Number(jqXHR.getResponseHeader("Fourze-Delay"))
            result.value = data.data
        }
    })

})






</script>
