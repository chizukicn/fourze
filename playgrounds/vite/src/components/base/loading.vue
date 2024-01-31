<script lang="tsx">
import { defineComponent, renderSlot } from "vue";

export default defineComponent({
  props: {
    loading: {
      type: Boolean,
      default: () => false
    },
    spinClass: {
      type: String,
      default: () => "n-loading-default-spin text-light-blue-300"
    }
  },
  setup(props, { slots }) {
    return () => {
      return (
        <div class={"h-full w-full relative items-center justify-center".concat(" ")}>
          <div v-show={props.loading} class="bg-white flex h-full bg-opacity-80 w-full z-99 duration-300 absolute items-center justify-center">
            <div class={props.spinClass}></div>
          </div>
          <div>
            {renderSlot(slots, "default")}
          </div>
        </div>
      );
    };
  }
});
</script>

<style lang="scss">
.n-loading-default-spin {
  border: 4px solid transparent;
  border-radius: 50%;
  border-top: 4px solid currentColor;
  width: 48px;
  height: 48px;
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
