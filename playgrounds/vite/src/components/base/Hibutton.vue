<script lang="tsx">
import { defineComponent, renderSlot } from "vue";

export default defineComponent({
  name: "IButton",
  props: {
    disabled: {
      type: Boolean,
      default: false
    },
    small: {
      type: Boolean,
      default: false
    },
    size: {
      type: String,
      default: "normal"
    }
  },
  setup(props, { slots }) {
    return () => {
      return <button class="rounded-sm outline-none bg-light-blue-400 text-white py-1 px-2 i-button hover:bg-opacity-60">{renderSlot(slots, "default")}</button>;
    };
  }
});
</script>

<style lang="scss">

</style>
