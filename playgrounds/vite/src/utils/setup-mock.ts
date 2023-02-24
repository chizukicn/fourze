export type RequestPath = `${"get" | "post" | "delete"}:${string}` | string;

export interface Pagination {
  page?: number
  pageSize?: number
  total?: number
}

export interface ResponseData {
  code: number
  data: any
  msg: string
}

export interface PageData<T> {
  currentPageIndex: number
  items: T[]
  nextIndex: number
  pageSize: number
  previousIndex: number
  startIndex: number
  totalCount: number
  totalPageCount: number
}
export function slicePage<T>(
  content: T[],
  pagination: Pagination
): PageData<T> {
  const { page = 1, pageSize = 10 } = pagination;
  const total = content.length;
  content = content.slice((page - 1) * pageSize, page * pageSize);
  return {
    items: content,
    totalCount: total,
    totalPageCount: Math.ceil(total / pageSize),
    currentPageIndex: page,
    pageSize,
    startIndex: 0,
    nextIndex: 0,
    previousIndex: 0
  };
}

export const successResponseWrap = (data?: unknown, contentType?: string | null) => {
  if (!contentType?.startsWith("application/json")) {
    return data;
  }

  return {
    data: data ?? null,
    code: "Success",
    succ: true
  };
};

export function successPageWrap<T>(
  data: T[],
  pagination: Pagination,
  msg?: string
) {
  return successResponseWrap(slicePage(data, pagination), msg);
}

export const failResponseWrap = (error: Error) => {
  return {
    data: null,
    code: "Error",
    msg: error.message
  };
};
