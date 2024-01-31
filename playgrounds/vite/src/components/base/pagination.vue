<script lang="tsx">
import { onKeyStroke } from "@vueuse/core";
import type { PropType } from "vue";
import { computed, defineComponent, onUnmounted } from "vue";

export default defineComponent({
  props: {
    page: {
      type: Number,
      default: () => 0
    },
    totalPage: {
      type: Number,
      default: () => 0
    },
    minPage: {
      type: Number,
      default: () => 1
    },
    parent: {
      type: Object as PropType<HTMLElement>,
      default: () => document
    },
    disabled: {
      type: Boolean,
      default: false
    },
    buttonClass: {
      type: String,
      default: ""
    }

  },
  emits: ["update:page", "prev", "change", "next"],
  setup(props, { emit }) {
    const totalPage = computed(() => (Number.isNaN(props.totalPage) ? props.minPage : props.totalPage));

    const page = computed({
      get() {
        if (Number.isNaN(props.page)) {
          return props.minPage;
        }
        return Math.max(Math.min(props.page, totalPage.value), props.minPage);
      },
      set(val) {
        emit("update:page", val);
      }
    });

    function prev(e: Event) {
      e.preventDefault();
      if (page.value > 1 && !props.disabled) {
        page.value--;
        emit("prev");
        emit("change", page.value);
      }
    }

    function next(e: Event) {
      e.preventDefault();
      if (page.value < totalPage.value && !props.disabled) {
        page.value = page.value + 1;
        emit("next");
        emit("change", page.value);
      }
    }

    const removePrev = onKeyStroke(["F1", "PageUp"], prev, { target: props.parent });
    const removeNext = onKeyStroke(["F2", "PageDown"], next, { target: props.parent });

    onUnmounted(() => {
      removePrev();
      removeNext();
    });

    return () => {
      return (
        <div class="flex space-x-1 h-10 w-full items-center justify-center">
          <div class={props.buttonClass} disabled={page.value <= 1 || props.disabled} onClick={prev}>&lt;</div>
          <span class="text-center w-8 select-none">
            {page.value}
            /
            {totalPage.value}
          </span>
          <div class={props.buttonClass} disabled={page.value >= totalPage.value || props.disabled} onClick={next}>&gt;</div>
        </div>
      );
    };
  }
});
</script>

<style lang="scss">

</style>
