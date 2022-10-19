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

                <Selection item-class="px-4 py-1 select-none cursor-pointer" active-class="bg-light-blue-300 text-white"
                    unactive-class="text-light-blue-300" v-model="args.type" class="flex space-x-4 py-2 items-center">
                    <Item value="fetch">Fetch</Item>
                    <Item value="axios">Axios</Item>
                    <Item value="jquery">JQuery</Item>
                </Selection>
                <Loading :loading="isLoading">
                    <Table :data="state.items" :columns="columns" row-key="id" />
                    <Pagination @change="execute()" :total-page="state.totalPageCount" v-model:page="args.page">
                    </Pagination>
                </Loading>
            </div>


        </div>

    </div>
</template>

<script setup lang="tsx">
import { useAsyncState } from "@vueuse/core"
import axios from "axios"
import dayjs from "dayjs"
import $ from "jquery"
import { computed, reactive, ref, watch } from "vue"
import Button from "./components/base/button.vue"
import Item from "./components/base/item.vue"
import Loading from "./components/base/loading.vue"
import Selection from "./components/base/selection.vue"
import Table from "./components/base/table"
import { TableColumns } from "./components/hooks/table"



const t = ref(0)

const avatarUrl = computed(() =>
    `/api/img/avatar.jpg?t=${t.value} `
)


function upload() {
    const fileElement = document.createElement("input")
    fileElement.type = "file"
    fileElement.onchange = async (e) => {
        if (fileElement.files) {
            const formData = new FormData()
            formData.append("file", fileElement.files[0])
            formData.append("name", "avatar")
            await axios.post("/api/upload/avatar", formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            })
            t.value = new Date().getTime()
        }
    }
    fileElement.click()
}


const args = reactive({
    type: "fetch" as "fetch" | "axios" | "jquery",
    keyword: "",
    page: 1
})


const columns: TableColumns<UserInfo> = [
    {
        dataIndex: "username",
        title: "User Name",
        width: 160
    },
    {
        dataIndex: "phone",
        title: "Phone",
        width: 160
    },
    {
        dataIndex: "createdTime",
        title: "Created Time",
        width: 160,
        render({ record }) {
            return dayjs(record.createdTime).format("YYYY-MM-DD HH:mm:ss")
        }
    },
    {
        dataIndex: "operation",
        title: "Operation",
        width: 160,
        render({ record }) {
            return <div>
                <Button size="small">Edit</Button>
                <Button size="small" type="danger">Delete</Button>
            </div>
        }
    }
]


const handleFetch = async () => {
    return fetch(`/api/search/${args.keyword}?page=${args.page}`)
        .then(r => r.json())
        .then(r => r.data)
}


const handleAxios = async () => {
    return axios.get(`/api/search/${args.keyword}`, { params: { page: args.page } }).then(r => r.data.data)
}


const handleJQuery = async () => {
    return $.ajax({
        url: `/api/search/${args.keyword}`,
        type: "get",
        contentType: "application/json",
        data: {
            page: args.page
        }
    }).then(r => r.data)
}


const { state, isLoading, execute } = useAsyncState<PagingData<UserInfo>>(() => {
    switch (args.type) {
        case "axios":
            return handleAxios()
        case "fetch":
            return handleFetch()
        case "jquery":
            return handleJQuery()
    }
}, {
    items: [],
    totalCount: 0,
    totalPageCount: 0,
    currentPageIndex: 1,
    pageSize: 10,
    nextIndex: 2,
    previousIndex: 0,
    startIndex: 1
}, { resetOnExecute: false })


watch(args, () => execute())






</script>
