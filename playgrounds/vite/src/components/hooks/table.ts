import type { CSSProperties, PropType, VNode } from "vue";

export interface PaginationProps {}

export interface PagingData<T> {
  items: T[];
}

export interface UseTableOptions<T extends Record<string, any>> {
  data: PagingData<T> | T[];
  columns: TableColumn<T>[];
}

export interface TableRenderOptions<T = any> {
  rowIndex: number;
  record: T;
}

export type TableColumns<T extends Record<string, any>> = TableColumn<T>[];

export interface TableColumn<R extends Record<string, any> = any> extends Record<string, any> {
  title: string;
  dataIndex: keyof R | string;
  headerStyle?: CSSProperties | string;
  cellClass?: string | string[] | ((record: R) => string | string[]);
  render?: (options: TableRenderOptions<R>) => VNode | string | JSX.Element;
  width?: string | number;
  align?: "left" | "center" | "right";
}

export const tableProps = {
  data: {
    type: [Object, Array] as PropType<any[]>,
    default: () => []
  },
  columns: {
    type: Array as PropType<TableColumn<any>[]>,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  rowKey: {
    type: String,
    default: "id"
  },
  headerClass: {
    type: [String, Array] as PropType<string | string[]>
  },
  rowClass: {
    type: [Function, String, Array] as PropType<((record: any, index: number) => string | string[]) | string | string[]>
  },
  pagination: {
    type: [Object, Boolean] as PropType<PaginationProps | false>
  }
};
