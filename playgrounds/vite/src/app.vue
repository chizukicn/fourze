<template>
    <div class="px-4">
        <div class="">
            <div class=" font-bold py-2 text-2xl text-light-blue-400">Image Upload/Load</div>

            <div class="flex space-x-4 items-center">
                <img :style="{ width: '120px' , height:'120px' }" :src="avatarUrl" />
                <div>
                    <Button @click="upload">Upload</Button>
                </div>

            </div>
        </div>

        <div class="flex space-x-8 mt-8">
            <div>
                <div class=" font-bold py-2 text-2xl text-light-blue-400">XHR/FETCH GET</div>

                <div class="flex space-x-4 py-2 items-center">
                    <Button @click="handleFetch">Fetch</Button>
                    <Button @click="handleAxios">Axios</Button>
                    <Button @click="handleJQuery">JQuery</Button>
                </div>
                <div class="w-100">
                    <div v-show="time" class="text-lg text-light-blue-400">loading time:{{time}}ms</div>
                </div>
                <Table :data="result.items" :columns="columns" row-key="id">
                </Table>
            </div>

            <div>
                <div class=" font-bold py-2 text-2xl text-light-blue-400">XHR/FETCH POST</div>
            </div>
        </div>

    </div>
</template>

<script setup lang="ts">
import { useNow } from "@vueuse/core"
import axios from "axios"
import $ from "jquery"
import type { MaybeAsyncFunction } from "maybe-types"
import { computed, ref } from "vue"
import Table from "./components/base/table"
import { TableColumns } from "./components/hooks/table"



const t = ref(0)

const avatarUrl = computed(() =>
    `/api/img/avatar.jpg?t=${t.value} `
)


function upload() {
    const file = document.createElement("input")
    file.type = "file"
    file.onchange = async (e) => {
        if (file.files) {
            const formData = new FormData()
            formData.append("file", file.files[0])
            formData.append("name", "avatar")
            await axios.post("/api/upload/avatar", formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            })
            t.value = new Date().getTime()
        }
    }
    file.click()
}


const keyword = ref("")

const result = ref<PagingData<UserInfo>>({
    items: [],
    totalCount: 0,
    totalPageCount: 0,
    currentPageIndex: 1,
    pageSize: 10,
    nextIndex: 2,
    previousIndex: 0,
    startIndex: 1
})

const columns: TableColumns<UserInfo> = [
    {
        dataIndex: "username",
        title: "username"
    },
    {
        dataIndex: "phone",
        title: "phone"
    },
    {
        dataIndex: "address",
        title: "address"
    }
]

const startTime = ref(0)
const endTime = ref(0)

const now = useNow()


const time = computed(() => {
    if (endTime.value === 0) {
        if (startTime.value == 0) {
            return 0
        }
        return now.value.getTime() - startTime.value
    }
    return endTime.value - startTime.value
})

const recoding = (fn: MaybeAsyncFunction<void>) => {
    return async (...args: any[]) => {
        startTime.value = Date.now()
        endTime.value = 0
        try {
            return await fn(...args)
        } catch (error) {
            result.value = error
        } finally {
            endTime.value = Date.now()
        }
    }
}

const handleFetch = recoding(async () => {
    result.value = await fetch(`/api/search/${keyword.value}`)
        .then(r => {
            return r.json()
        })
        .then(r => r.data)
})


const handleAxios = recoding(async () => {
    const rs = await axios.get(`/api/search/${keyword.value}`)
    result.value = rs.data.data
})


const handleJQuery = recoding(async () => {
    await $.ajax({
        url: `/api/search/${keyword.value}`,
        type: "get",
        contentType: "application/json",
        success: (data) => {
            result.value = data.data
        }
    })

})






</script>
