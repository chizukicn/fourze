import { computed, ComputedRef, inject, onDeactivated, PropType, renderSlot } from "vue"
import { defineHooks } from "../define"
import { BaseType, ClassType, valuePropType } from "../types"
import { AciveClassSymbol, ChangeActiveSymbol, DisabledSymbol, InitSymbol, IsActiveSymbol, ItemClassSymbol, Option, UnactiveSymbol } from "./constants"

export const itemProps = {
    value: {
        type: valuePropType,
        default() {
            return Math.random().toString(16).slice(2)
        }
    },
    label: {
        type: [Function, String] as PropType<string | ((val: BaseType) => string) | null>,
        default: () => null
    },
    keepAlive: {
        type: Boolean,
        default: () => true
    },
    key: {
        type: [String, Number, Symbol] as PropType<string | number | symbol>,
        default: () => null
    },
    disabled: {
        type: Boolean,
        default: () => false
    }
}

export const useSelectionItem = defineHooks(itemProps, (props, { slots }) => {
    const init = inject<(obj: any) => () => void>(InitSymbol)

    function render() {
        let label = props.label
        if (label) {
            if (typeof label == "function") {
                label = label(props.value)
            }
        }
        return label ?? renderSlot(slots, "default")
    }

    const id = Math.random().toString(36).slice(2, 9)

    const current = computed<Option>(() => {
        return {
            id,
            render,
            value: props.value
        }
    })

    if (!!init) {
        const remove = init(current)

        onDeactivated(remove)
    }

    const isActive = inject<(option: BaseType) => boolean>(IsActiveSymbol) ?? ((_: BaseType) => false)

    const changeActive = inject<(option: BaseType) => boolean>(ChangeActiveSymbol) ?? ((_: BaseType) => false)

    const itemClass = computed(() => {
        const classNames = [inject<ComputedRef<ClassType>>(ItemClassSymbol)?.value ?? ""]
        if (props.disabled) {
            classNames.push(disabledClass.value)
        } else {
            if (isActive(current.value.value)) {
                classNames.push(activeClass.value)
            } else {
                classNames.push(unactiveClass.value)
            }
        }
        return classNames
    })

    const activeClass = computed(() => {
        return inject<ComputedRef<ClassType>>(AciveClassSymbol)?.value ?? "active"
    })

    const unactiveClass = computed(() => {
        return inject<ComputedRef<ClassType>>(UnactiveSymbol)?.value ?? "unactive"
    })

    const disabledClass = computed(() => {
        return inject<ComputedRef<ClassType>>(DisabledSymbol)?.value ?? "disabled"
    })

    return {
        change() {
            if (!props.disabled) {
                changeActive(props.value)
            }
        },
        render,
        isActive,
        current,
        activeClass,
        unactiveClass,
        itemClass
    }
})

export interface ItemProps {}
