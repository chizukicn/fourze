export const AciveSymbol = Symbol("[i-selection]active")

export const InitSymbol = Symbol("[i-selection]init")

export const ModelValueSymbol = Symbol("[i-selection]model-value")

export const AciveClassSymbol = Symbol("[i-selection]active-class")
export const ItemClassSymbol = Symbol("[i-selection]item-class")
export const UnactiveSymbol = Symbol("[i-selection]unactive-class")
export const DisabledSymbol = Symbol("[i-selection]disabled-class")

export const ItemLabelSymbol = Symbol("[i-selection]label")
export const ItemOptionsSymbol = Symbol("[i-selection]options")

export const ChangeActiveSymbol = Symbol("[i-selection]change-active")

export const IsActiveSymbol = Symbol("[i-selection]is-active")

export interface Option {
    id?: string
    value: any | null
    render(): JSX.Element | string
}