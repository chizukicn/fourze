import { App } from "vue"
import { default as NItem } from "./item"
import { default as NTooltip } from "./tooltip"
import { default as NSelection } from "./selection"
import { default as NSwitch } from "./switch"
import { default as NTabs } from "./tabs"

export { NItem, NTooltip, NSelection, NSwitch, NTabs }

const components = {
    NItem,
    NTooltip,
    NSelection,
    NSwitch,
    NTabs
}

export default {
    install(app: App) {
        for (let [key, value] of Object.entries(components)) {
            app.component(key, value)
        }
    }
}
