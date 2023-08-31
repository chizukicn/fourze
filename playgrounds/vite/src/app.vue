<script setup lang="tsx">
import { getGlobalMockApp } from "@fourze/mock";
import { useAsyncState } from "@vueuse/core";
import axios from "axios";
import dayjs from "dayjs";
import $ from "jquery";
import querystring from "query-string";
import { computed, reactive, ref, watch } from "vue";
import { HiItem, HiSelection } from "hoci";
import Loading from "./components/base/loading.vue";
import Table from "./components/base/table.vue";
import type { TableColumns } from "./components/hooks/table";
import HiButton from "@/components/base/button.vue";

const _mockEnabled = ref(!!getGlobalMockApp()?.enabled);

const mockEnabled = computed({
  get() {
    return _mockEnabled.value;
  },
  set(value) {
    const router = getGlobalMockApp();
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
        <HiButton size="small">Edit</HiButton>
        <HiButton size="small" class="!bg-red-400" onClick={() => deleteById(record.id)}>Delete</HiButton>
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
  const _url = url;
  switch (type) {
    case "jquery":
      return $.ajax({
        url: querystring.stringifyUrl({
          url: _url,
          query: params
        }),
        data,
        method
      }).then(r => r.data);
    case "axios":
      return axios(_url, {
        method,
        params,
        data
      }).then(r => r.data.data);
    case "fetch":
    default:
      return await fetch(querystring.stringifyUrl({ url: _url, query: params }), {
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
    <div>
      <div>
        <div class=" font-bold mt-4 py-2 text-2xl text-light-blue-400">
          XHR/FETCH GET
        </div>
        <div class="flex space-x-4 items-center">
          <div class="font-bold text-lg text-light-blue-400">
            Mock Data:
          </div>
          <HiSelection
            v-model="mockEnabled" item-class="px-4 py-1 select-none cursor-pointer"
            active-class="bg-light-blue-300 text-white" unactive-class="text-light-blue-300"
            class="flex space-x-4 items-center"
          >
            <HiItem :value="true">
              Enable
            </HiItem>
            <HiItem :value="false">
              Disable
            </HiItem>
          </HiSelection>
        </div>
        <div class="flex space-x-4 mt-2 items-center">
          <div class="font-bold text-lg text-light-blue-400">
            Request Type:
          </div>
          <HiSelection
            v-model="args.type" item-class="px-4 py-1 select-none cursor-pointer"
            active-class="bg-light-blue-300 text-white" unactive-class="text-light-blue-300"
            class="flex space-x-4 items-center"
          >
            <HiItem value="fetch">
              Fetch
            </HiItem>
            <HiItem value="axios">
              Axios
            </HiItem>
            <HiItem value="jquery">
              JQuery
            </HiItem>
          </HiSelection>
        </div>
        <Loading :loading="isLoading" class="mt-4 w-240">
          <div class="min-h-128 ">
            <Table :data="state.items" :columns="columns" row-key="id" />
          </div>
          <Pagination
            v-model:page="args.page" button-class="px-2 bg-light-blue-300 text-white cursor-pointer select-none"
            :total-page="state.totalPageCount"
          />
        </Loading>
      </div>
    </div>
  </div>
</template>
