import SdfgGraph from "../graph/sdfgGraph";

export default interface Layouter {
    layout(graph: SdfgGraph): void;
}
