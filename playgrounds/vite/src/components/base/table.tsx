import { computed, defineComponent, reactive, renderList, SetupContext, VNodeChild } from "vue"
import { useDrag } from "../hooks/drag"
import { TableColumn, TableDraggable, tableProps, useTable } from "../hooks/table"
import IconDrag from "./icon/icon-drag.vue"
import IconMinus from "./icon/icon-minus.vue"
import IconPlus from "./icon/icon-plus.vue"

export default defineComponent({
    props: {
        ...tableProps
    },
    emits: ["rowDrag"],
    setup(props, context) {
        const {} = useTable(props as any, context as SetupContext)

        function getAlignClass(align: TableColumn["align"] = "left") {
            switch (align) {
                case "left":
                    return "text-left"
                case "center":
                    return "text-center"
                case "right":
                    return "text-right"
                default:
                    return ""
            }
        }

        function getColumnClass(column: TableColumn) {
            return [getAlignClass(column.align)].concat("h-12")
        }

        function getTdClass(column: TableColumn, record: any, isDragEnter = false) {
            const cellClass = record != null ? (typeof column.cellClass === "function" ? column.cellClass(record) : column.cellClass) ?? "" : ""
            return getColumnClass(column).concat("outline-none relative text-sm overflow-ellipsis").concat(cellClass)
        }

        const tableClass = "w-full border-1 border-solid border-hex-454545 rounded"

        const expandKeys = reactive<string[]>([])

        function handleClickExpand(item: any) {
            return () => {
                const key = item[props.rowKey]
                const index = expandKeys.indexOf(key)
                if (index > -1) {
                    expandKeys.splice(index, 1)
                } else {
                    expandKeys.push(key)
                }
            }
        }

        function getJustify(align: "left" | "center" | "right" = "left") {
            switch (align) {
                case "left":
                    return "justify-start"
                case "center":
                    return "justify-center"
                case "right":
                    return "justify-end"
            }
        }

        const draggable = computed<TableDraggable>(() => {
            if (!props.draggable) {
                return {}
            }
            if (props.draggable === true) {
                return {
                    type: "handle"
                }
            }
            return props.draggable
        })

        const { dragType, dragState, handleDragEnd, handleDragStart, handleDragover, handleDrop, handleDragEnter } = useDrag(draggable)

        function renderRow(data: any[], showExpand = false, deep: number = 0, indexPath: number[] = []): VNodeChild[] {
            return renderList(data, (record, rowIndex) => {
                const currentPath = (indexPath ?? []).concat(rowIndex)
                const hasExpand: boolean = !!record.children && record.children?.length > 0

                const currentRowKey: any = record[props.rowKey]

                showExpand = !expandKeys.includes(currentRowKey) && hasExpand

                const rowClass = (typeof props.rowClass === "function" ? props.rowClass(record, rowIndex) : props.rowClass ?? "").concat(getRowClass(dragState.targetKey == currentRowKey))

                const allowDrag = !!props.draggable

                const dragSourceEvent = dragType.value
                    ? {
                          draggable: allowDrag,
                          onDragstart: (ev: DragEvent) => {
                              if (!allowDrag) {
                                  return
                              }
                              handleDragStart(ev, record[props.rowKey], currentPath, record.raw)
                          },
                          onDragend: (ev: DragEvent) => {
                              if (!allowDrag) {
                                  return
                              }
                              handleDragEnd(ev)
                          }
                      }
                    : {}

                const dragTargetEvent = dragType.value
                    ? {
                          onDragenter: (ev: DragEvent) => {
                              if (!allowDrag) {
                                  return
                              }
                              window.scrollTo({
                                  top: ev.clientY
                              })

                              handleDragEnter(ev, currentPath, currentRowKey)
                          },
                          onDragover: (ev: DragEvent) => {
                              if (!allowDrag) {
                                  return
                              }
                              handleDragover(ev)
                          },
                          onDrop: (ev: DragEvent) => {
                              if (!allowDrag) {
                                  return
                              }
                              context.emit("rowDrag", dragState.sourceKey, currentRowKey)
                              handleDrop(ev)
                          }
                      }
                    : {}

                return (
                    <>
                        <tr {...(dragType.value === "row" ? dragSourceEvent : {})} {...dragTargetEvent} class={["outline-none relative hover:bg-hex-f2f3f5 cr-table-tr"].concat(rowClass)}>
                            {allowDrag ? (
                                <td {...(dragType.value === "handle" ? dragSourceEvent : {})} draggable={true} class={["border-solid cursor-move outline-none p-4 "]}>
                                    <IconDrag class="h-4 w-4 cr-table-drag" />
                                </td>
                            ) : (
                                <td class="border-solid outline-none p-4"></td>
                            )}

                            {renderList(
                                props.columns.filter(r => !!r),
                                column => {
                                    const content = column.render
                                        ? column.render({
                                              record,
                                              rowIndex
                                          })
                                        : record[column.dataIndex]

                                    return (
                                        <td
                                            class={getTdClass(column, record, dragState.targetKey === currentRowKey)}
                                            style={column.dataIndex == props.expandKey ? `padding-left:calc(40px * ${deep} + 16px)` : ""}
                                        >
                                            <div class={["flex items-center"].concat(getJustify(column.align))}>
                                                {column.dataIndex == props.expandKey && (
                                                    <div class="h-5 w-5">
                                                        {hasExpand && (
                                                            <button
                                                                onClick={handleClickExpand(record)}
                                                                class="bg-hex-00baad text-hex-fff  arco-expand-btn cr-table-expand-btn hover:bg-hex-04decf active:bg-hex-00a196"
                                                            >
                                                                {showExpand ? <IconMinus class="h-14px w-14px"></IconMinus> : <IconPlus class="h-14px w-14px"></IconPlus>}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {content}
                                            </div>
                                        </td>
                                    )
                                }
                            )}
                        </tr>
                        {showExpand && renderRow(record.children, showExpand, deep + 1)}
                    </>
                )
            })
        }

        const dragRootEvent = {
            onDragenter(ev: DragEvent) {
                if (!props.draggable) {
                    return
                }
                handleDragEnter(ev, [], 0)
            },
            onDragover: (ev: DragEvent) => {
                if (!props.draggable) {
                    return
                }
                handleDragover(ev)
            },
            onDrop(ev: DragEvent) {
                if (!props.draggable) {
                    return
                }
                context.emit("rowDrag", dragState.sourceKey, 0)
                handleDrop(ev)
            }
        }

        function getRowClass(isDragEnter: boolean = false) {
            if (isDragEnter) {
                return " border-primary border-dashed  border-b-1"
            }
            return " border-hex-454545 border-solid border-b-1"
        }

        return () => (
            <table class={tableClass}>
                <colgroup>
                    <col class="w-12"></col>
                    {renderList(props.columns, column => {
                        return <col style={column.headerStyle ?? `width:${column.width}px;min-width:${column.width}px;max-width:${column.width}px`} />
                    })}
                </colgroup>
                <thead class={props.headerClass}>
                    <tr {...dragRootEvent} class={getRowClass(dragState.targetKey === 0)}>
                        <th></th>
                        {renderList(props.columns, column => (
                            <th class={getTdClass(column, null)}>{column.title}</th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {props.data?.length > 0 || props.loading ? (
                        renderRow(props.data)
                    ) : (
                        <tr>
                            <td colspan={24}></td>
                        </tr>
                    )}
                </tbody>
            </table>
        )
    }
})
