<script lang="tsx">
import type { VNodeChild } from "vue";
import type { TableColumn } from "../hooks/table";
import { defineComponent, renderList } from "vue";
import { tableProps } from "../hooks/table";

export default defineComponent({
  props: {
    ...tableProps
  },
  setup(props) {
    function getAlignClass(align: TableColumn["align"] = "left") {
      switch (align) {
        case "left":
          return "text-left";
        case "center":
          return "text-center";
        case "right":
          return "text-right";
        default:
          return "";
      }
    }

    function getColumnClass(column: TableColumn) {
      return [getAlignClass(column.align)].concat("h-12");
    }

    function getTdClass(column: TableColumn, record: any) {
      const cellClass = record != null ? (typeof column.cellClass === "function" ? column.cellClass(record) : column.cellClass) ?? "" : "";
      return getColumnClass(column).concat("outline-none relative text-sm overflow-ellipsis").concat(cellClass);
    }

    const tableClass = "w-full border-1 border-solid border-hex-454545 rounded";

    function getJustify(align: "left" | "center" | "right" = "left") {
      switch (align) {
        case "left":
          return "justify-start";
        case "center":
          return "justify-center";
        case "right":
          return "justify-end";
      }
    }

    function renderRow(data: any[], showExpand = false, deep = 0): VNodeChild[] {
      return renderList(data, (record, rowIndex) => {
        const rowClass = (typeof props.rowClass === "function" ? props.rowClass(record, rowIndex) : props.rowClass ?? "").concat(getRowClass());

        return (
          <>
            <tr class={["outline-none relative hover:bg-hex-f2f3f5 cr-table-tr"].concat(rowClass)}>

              <td class="border-solid outline-none p-4"></td>

              {renderList(
                props.columns.filter((r) => !!r),
                (column) => {
                  const content = column.render
                    ? column.render({
                        record,
                        rowIndex
                      })
                    : record[column.dataIndex];

                  return (
                    <td
                      class={getTdClass(column, record)}
                    >
                      <div class={["flex items-center"].concat(getJustify(column.align))}>
                        {content}
                      </div>
                    </td>
                  );
                }
              )}
            </tr>
            {showExpand && renderRow(record.children, showExpand, deep + 1)}
          </>
        );
      });
    }

    function getRowClass(isDragEnter = false) {
      if (isDragEnter) {
        return " border-primary border-dashed  border-b-1";
      }
      return " border-hex-454545 border-solid border-b-1";
    }

    return () => (
      <table class={tableClass}>
        <colgroup>
          <col class="w-12"></col>
          {renderList(props.columns, (column) => {
            return <col style={column.headerStyle ?? `width:${column.width}px;min-width:${column.width}px;max-width:${column.width}px`} />;
          })}
        </colgroup>
        <thead class={props.headerClass}>
          <tr class={getRowClass()}>
            <th></th>
            {renderList(props.columns, (column) => (
              <th class={getTdClass(column, null)}>{column.title}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {props.data?.length > 0 || props.loading
            ? (
                renderRow(props.data)
              )
            : (
                <tr>
                  <td colspan={24}></td>
                </tr>
              )}
        </tbody>
      </table>
    );
  }
});
</script>
