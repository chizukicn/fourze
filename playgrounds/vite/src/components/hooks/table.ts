import { CSSProperties, PropType, VNode } from "vue"
import { defineHooks } from "./define"

export interface PaginationProps {}

export interface PagingData<T> {
    items: T[]
}

export interface UseTableOptions<T extends Record<string, any>> {
    data: PagingData<T> | T[]
    columns: TableColumn<T>[]
}

export interface TableRenderOptions<T = any> {
    rowIndex: number
    record: T
}

export type TableColumns<T extends Record<string, any>> = TableColumn<T>[]

export interface TableColumn<R extends Record<string, any> = any> extends Record<string, any> {
    title: string
    dataIndex: keyof R | string
    headerStyle?: CSSProperties | string
    cellClass?: string | string[] | ((record: R) => string | string[])
    render?: (options: TableRenderOptions<R>) => VNode
    width?: string | number
    align?: "left" | "center" | "right"
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
    expandKey: {
        type: String
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
    draggable: {
        type: [Object, Boolean] as PropType<TableDraggable | boolean>
    },
    pagination: {
        type: [Object, Boolean] as PropType<PaginationProps | false>
    }
}

export interface TableDraggable {
    /**
     * @zh 拖拽类型
     * @en drag type
     */
    type?: "row" | "handle"
    /**
     * @zh 列标题
     * @en Column title
     */
    title?: string
    /**
     * @zh 列宽度
     * @en Column width
     */
    width?: number
    /**
     * @zh 是否固定
     * @en Is it fixed
     */
    fixed?: boolean
}

export const useTable = defineHooks(tableProps, props => {
    return {}
})
