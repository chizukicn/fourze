import { computed, reactive, Ref } from "vue"

export type ID = string | number

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

export const useDrag = (draggable: Ref<TableDraggable | undefined>) => {
    const dragType = computed(() => {
        if (draggable.value) {
            if (draggable.value.type === "handle") {
                return "handle"
            }
            return "row"
        }
        return undefined
    })

    const dragState = reactive({
        dragging: false,
        sourceKey: <ID>"",
        targetKey: <ID>"",
        sourcePath: [] as number[],
        targetPath: [] as number[],
        data: {} as Record<string, unknown>
    })

    const clearDragState = () => {
        dragState.dragging = false
        dragState.sourceKey = ""
        dragState.targetKey = ""
        dragState.sourcePath = []
        dragState.targetPath = []
        dragState.data = {}
    }

    const handleDragStart = (ev: DragEvent, sourceKey: ID, sourcePath: number[], data: Record<string, unknown>) => {
        if (ev.dataTransfer) {
            ev.dataTransfer.effectAllowed = "move"
            if (ev.target && (ev.target as HTMLElement).tagName === "TD") {
                const { parentElement } = ev.target as HTMLElement
                if (parentElement && parentElement.tagName === "TR") {
                    ev.dataTransfer.setDragImage(parentElement, 0, 0)
                }
            }
        }
        dragState.dragging = true
        dragState.sourceKey = sourceKey
        dragState.sourcePath = sourcePath
        dragState.data = data
    }

    const handleDragEnter = (ev: DragEvent, targetPath: number[], targetKey: ID) => {
        if (ev.dataTransfer) {
            ev.dataTransfer.dropEffect = "move"
        }
        dragState.targetPath = targetPath
        dragState.targetKey = targetKey
        ev.preventDefault()
    }

    const handleDragLeave = (ev: DragEvent) => {
        dragState.targetKey = ""
    }

    const handleDragover = (ev: DragEvent) => {
        if (ev.dataTransfer) {
            ev.dataTransfer.dropEffect = "move"
        }
        ev.preventDefault()
    }

    const handleDragEnd = (ev: DragEvent) => {
        dragState.targetKey = ""
        if (ev.dataTransfer?.dropEffect === "none") {
            clearDragState()
        }
    }

    const handleDrop = (ev: DragEvent) => {
        clearDragState()
        ev.preventDefault()
    }

    return {
        dragType,
        dragState,
        handleDragStart,
        handleDragEnter,
        handleDragLeave,
        handleDragover,
        handleDragEnd,
        handleDrop
    }
}
