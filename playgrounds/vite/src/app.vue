<script setup lang="tsx">
  import { getGlobalMockRouter } from "@fourze/mock";
  import { useAsyncState } from "@vueuse/core";
  import axios from "axios";
  import dayjs from "dayjs";
  import $ from "jquery";
  import querystring from "query-string";
  import { computed, reactive, ref, watch } from "vue";
  import Button from "./components/base/button.vue";
  import Item from "./components/base/item.vue";
  import Loading from "./components/base/loading.vue";
  import Selection from "./components/base/selection.vue";
  import Table from "./components/base/table";
  import type { TableColumns } from "./components/hooks/table";

  const t = ref(0);

  const avatarUrl = computed(() =>
    `/api/img/avatar.jpg?t=${t.value} `
  );

  const _mockEnabled = ref(!!getGlobalMockRouter()?.enabled);

  const mockEnabled = computed({
    get() {
      return _mockEnabled.value;
    },
    set(value) {
      const router = getGlobalMockRouter();
      if (router) {
        if (value) {
          router.enable();
        } else {
          router.disable();
        }
      }
      _mockEnabled.value = value;
    }
  });

  function upload() {
    const fileElement = document.createElement("input");
    fileElement.type = "file";
    fileElement.onchange = async (e) => {
      if (fileElement.files) {
        const formData = new FormData();
        formData.append("file", fileElement.files[0]);
        formData.append("name", "avatar");
        await axios.post("/api/upload/avatar", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            "X-Fourze-Mock": "off" // disable mock.
          }
        });
        t.value = new Date().getTime();
      }
    };
    fileElement.click();
  }

  const args = reactive({
    type: "fetch" as "fetch" | "axios" | "jquery",
    keyword: "",
    page: 1
  });

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
        return dayjs(record.createdTime).format("YYYY-MM-DD HH:mm:ss");
      }
    },
    {
      dataIndex: "source",
      title: "Source",
      width: 160
    },
    {
      dataIndex: "operation",
      title: "Operation",
      width: 160,
      render({ record }) {
        return <div class="space-x-2">
                <Button size="small">Edit</Button>
                <Button size="small" class="!bg-red-400" onClick={() => deleteById(record.id)}>Delete</Button>
            </div>;
      }
    }
  ];

  interface RequestOptions {
    url: string
    method?: string
    params?: Record<string, any>
    type?: "jquery" | "fetch" | "axios"
    data?: Record<string, any>
  }

  async function request(options: RequestOptions) {
    const { url, method = "GET", params = {}, data = {}, type = "fetch" } = options;
    switch (type) {
      case "jquery":
        return $.ajax({
          url: querystring.stringifyUrl({
            url,
            query: params
          }),
          data,
          method
        }).then(r => r.data);
      case "axios":
        return axios(url, {
          method,
          params,
          data
        }).then(r => r.data.data);
      case "fetch":
      default:
        return await fetch(querystring.stringifyUrl({ url, query: params }), {
          body: ["GET", "HEAD", "DELETE"].includes(method.toUpperCase()) ? undefined : JSON.stringify(data),
          method
        }).then(r => r.json()).then(r => r.data);
    }
  }

  const { state, isLoading, execute } = useAsyncState<PagingData<UserInfo>>(() => {
    return request({
      url: "/api/item/list",
      params: {
        page: args.page,
        keyword: args.keyword
      },
      type: args.type,
      method: "get"
    }) as Promise<PagingData<UserInfo>>;
  }, {
    items: [],
    totalCount: 0,
    totalPageCount: 0,
    currentPageIndex: 1,
    pageSize: 10,
    nextIndex: 2,
    previousIndex: 0,
    startIndex: 1
  }, { resetOnExecute: false });

  async function deleteById(id: string) {
    await request({
      url: `/api/item/${id}`,
      type: args.type,
      method: "DELETE"
    });
    await execute();
  }

  watch([args, mockEnabled], () => execute(), { deep: true });
</script>

<template>
  <div class="px-4">
    <div class="">
      <div class=" font-bold py-2 text-2xl text-light-blue-400">
        Image Upload/Load
      </div>

      <div class="flex space-x-4 items-center">
        <img :style="{ width: '120px', height: '120px' }" :src="avatarUrl">
        <div>
          <Button @click="upload">
            Upload
          </Button>
        </div>
      </div>
    </div>

    <div>
      <div>
        <div class=" font-bold mt-4 py-2 text-2xl text-light-blue-400">
          XHR/FETCH GET
        </div>
        <div class="flex space-x-4 items-center">
          <div class="font-bold text-lg text-light-blue-400">
            Mock Data:
          </div>
          <Selection
            v-model="mockEnabled"
            item-class="px-4 py-1 select-none cursor-pointer" active-class="bg-light-blue-300 text-white"
            unactive-class="text-light-blue-300" class="flex space-x-4 items-center"
          >
            <Item :value="true">
              Enable
            </Item>
            <Item :value="false">
              Disable
            </Item>
          </Selection>
        </div>
        <div class="flex space-x-4 mt-2 items-center">
          <div class="font-bold text-lg text-light-blue-400">
            Request Type:
          </div>
          <Selection
            v-model="args.type"
            item-class="px-4 py-1 select-none cursor-pointer" active-class="bg-light-blue-300 text-white"
            unactive-class="text-light-blue-300" class="flex space-x-4 items-center"
          >
            <Item value="fetch">
              Fetch
            </Item>
            <Item value="axios">
              Axios
            </Item>
            <Item value="jquery">
              JQuery
            </Item>
          </Selection>
        </div>
        <Loading :loading="isLoading" class="mt-4 w-240">
          <div class="min-h-128 ">
            <Table :data="state.items" :columns="columns" row-key="id" />
          </div>
          <Pagination
            v-model:page="args.page"
            button-class="px-2 bg-light-blue-300 text-white cursor-pointer select-none" :total-page="state.totalPageCount"
          />
        </Loading>
      </div>
    </div>
  </div>
</template>
