import SdfgEdge from "./sdfgEdge";

export default class InterstateEdge extends SdfgEdge {
    label(): string {
        return this.attributes.label;
    }
}