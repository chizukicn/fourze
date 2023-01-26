import { MaybeDate } from "maybe-types";

declare global {
  export interface ResponseData {
    code: number;
    data: any;
    msg: string;
  }

  export interface PagingData<T> {
    currentPageIndex: number;
    items: T[];
    nextIndex: number;
    pageSize: number;
    previousIndex: number;
    startIndex: number;
    totalCount: number;
    totalPageCount: number;
  }

  export interface UserInfo {
    id: string;
    username: string;
    phone: number;
    createdTime: MaybeDate;
    source: string;
  }
}

export {};
