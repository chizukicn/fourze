import fs from "fs";
import path from "path";
import type { FourzeHandle, ObjectProps } from "@fourze/core";
import {
  PolyfillFile,
  createStorage,
  defineFourze,
  isNode,
  jsonWrapperHook,
  randomArray,
  randomDate,
  randomInt,
  randomItem,
} from "@fourze/core";
import {
  failResponseWrap,
  slicePage,
  successResponseWrap,
} from "../utils/setup-mock";

interface Pagination {
  page: number;
  pageSize: number;
}

export interface SwaggerMeta extends Record<string, any> {
  summary: string;
}

export default defineFourze((fourze) => {
  fourze.hook(
    jsonWrapperHook(
      (data) => successResponseWrap(data),
      (error) => failResponseWrap(error.message)
    )
  );

  fourze.get(
    "/test",
    {
      name: {
        type: String,
        required: true,
        meta: {
          title: "姓名",
        },
      },
    },
    {
      summary: "测试",
    },
    (req) => req.meta.summary
  );

  // person names

  const storage = createStorage();
  const createData = (source: "server" | "mock") => {
    if (storage.hasItem("fz_cache_data")) {
      return storage.getItem("fz_cache_data") as UserInfo[];
    }

    const data = randomArray<UserInfo>(
      (value) => {
        return {
          id: `${randomInt(100, 999)}${String(value).padStart(4, "0")}`,
          username: randomItem([
            "Zhangsan",
            "Lisi",
            "Wangwu",
            "Zhaoliu",
            "Yan7",
            "Jack",
            "Rose",
            "Tom",
            "Jerry",
            "Henry",
            "Nancy",
          ]),
          phone: randomInt("13000000000-19999999999"),
          createdTime: randomDate("2020-01-01", "2021-01-01"),
          allow: randomItem(["fetch", "xhr"]),
          source,
        };
      },
      40,
      80
    );
    storage.setItem("fz_cache_data", data);
    return data;
  };

  const data = isNode() ? createData("server") : createData("mock");

  const handleSearch: FourzeHandle<
    ObjectProps<Pagination>,
    any,
    PagingData<UserInfo>
  > = async (req) => {
    const {
      page = 1,
      pageSize = 10,
      keyword = "",
    } = req.query as unknown as Pagination & { keyword?: string };
    const items = data.filter((item) => item.username.includes(keyword));
    return slicePage(items, { page, pageSize });
  };

  fourze("GET /item/list", handleSearch);

  fourze(
    "DELETE /item/{id}",
    {
      id: {
        type: String,
        required: true,
        in: "path",
      },
    },
    async (req) => {
      const { id } = req.params;
      const index = data.findIndex((item) => item.id === id);
      throw new Error(`item(${id}) not exists`);
      data.splice(index, 1);
      storage.setItem("fz_cache_data", data);
      return { result: true };
    }
  );

  fourze("/img/avatar.jpg", async (req, res) => {
    let avatarPath = path.resolve(__dirname, ".tmp/avatar.jpg");
    if (!fs.existsSync(avatarPath)) {
      avatarPath = path.resolve(__dirname, "./test.webp");
    }
    res.setHeader("Fourze-Delay", 0);
    const f = await fs.promises.readFile(avatarPath);
    res.image(f);
  });

  fourze(
    "/upload/avatar",
    {
      file: {
        type: PolyfillFile,
        required: true,
        in: "body",
      },
    },
    {},
    async (req) => {
      const file = req.body.file;
      if (!fs.existsSync(path.resolve(__dirname, ".tmp"))) {
        fs.mkdirSync(path.resolve(__dirname, ".tmp"));
      }

      await fs.promises.writeFile(
        path.resolve(__dirname, ".tmp/avatar.jpg"),
        file.body
      );
      return {
        size: file.size,
      };
    }
  );

  return [];
});
