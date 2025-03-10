/**
 * @Author: Kritsu
 * @Date:   2021/11/16 23:07:51
 * @Last Modified by:   Kritsu
 * @Last Modified time: 2021/11/17 18:49:42
 */
import type { CSSProperties, PropType } from "vue";
import { computed, defineComponent, nextTick, reactive, ref, renderSlot, Teleport, Transition, watch } from "vue";

export const tooltipProps = {
  popClass: {
    type: String
  },
  position: {
    type: String as PropType<"bottom" | "top" | "left" | "right">,
    default: () => "bottom"
  },
  offset: {
    type: Number,
    default: () => 4
  },
  lazy: {
    type: Boolean,
    default: () => false
  },
  triggerType: {
    type: String as PropType<"click" | "hover">,
    default: () => "hover"
  }
};

export default defineComponent({
  name: "ITooltip",
  props: tooltipProps,
  emits: ["change"],
  setup(props, { slots, emit }) {
    const isOpen = ref(false);

    const triggerRef = ref<HTMLElement>();
    const popupRef = ref<HTMLElement>();

    const dropdownPosition = reactive({ x: 0, y: 0 });

    const isShow = computed(() => isOpen.value && triggerRef.value && popupRef.value && dropdownPosition.x + dropdownPosition.y > 0);

    const dropdownStyle = computed<CSSProperties>(() => {
      return {
        left: `${dropdownPosition.x}px`,
        top: `${dropdownPosition.y}px`,
        visibility: isShow.value ? "visible" : "hidden",
        position: "fixed"
      };
    });

    function onClick() {
      if (props.triggerType === "click") {
        isOpen.value = true;
      }
    }

    function onMouseover() {
      if (props.triggerType === "hover") {
        isOpen.value = true;
      }
    }

    function onMouseout() {
      if (props.triggerType === "hover") {
        isOpen.value = false;
      }
    }

    function resize() {
      const trigger = triggerRef.value;
      const popup = popupRef.value;

      if (!!trigger && !!popup) {
        const { width, height, left, top } = trigger.getBoundingClientRect();

        const { clientWidth: pWidth, clientHeight: pHeight } = popup;

        let x = 0;
        let y = 0;

        const offset = props.offset;
        switch (props.position) {
          case "bottom":
            x = left;
            y = top + height + offset;
            break;
          case "top":
            x = left;
            y = top - pHeight - offset;
            break;
          case "left":
            x = left - pWidth - offset;
            y = top;
            break;
          case "right":
            x = left + width + offset;
            y = top;
            break;
        }
        dropdownPosition.x = x;
        dropdownPosition.y = y;
      }
    }

    watch(isOpen, (val) => {
      if (val) {
        nextTick(resize);
      }
      emit("change", val);
    });

    return () => {
      return (
        <div {...{ onMouseout, onMouseover, onClick }} ref={triggerRef}>
          {renderSlot(slots, "default")}
          <Teleport to="body">
            <Transition name="dropdown" mode="out-in">
              <div class={[" z-999", props.popClass]} style={dropdownStyle.value} ref={popupRef}>
                {renderSlot(slots, "popper")}
              </div>
            </Transition>
          </Teleport>
        </div>
      );
    };
  }
});
