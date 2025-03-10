import type { BaseType } from "../hooks/types";
import { HiSelection, selectionProps } from "hoci";
import { computed, defineComponent, renderSlot } from "vue";
import { useRouter } from "vue-router";

export default defineComponent({
  props: {
    ...selectionProps,
    route: {
      type: Boolean
    }
  },
  setup(props, { slots, emit }) {
    const router = useRouter();
    const modelValue = computed<BaseType>({
      get() {
        let val = props.modelValue;
        if (props.route) {
          val = val ?? router.currentRoute.value.fullPath;
        }
        return val;
      },
      async set(val) {
        if (props.route && val) {
          val = decodeURIComponent(val.toString());
          await router.push(val);
        }
        emit("update:modelValue", val);
        emit("change", val);
      }
    });
    return () => (
      <HiSelection {...props} v-model={modelValue.value}>
        {renderSlot(slots, "default")}
      </HiSelection>
    );
  }
});
