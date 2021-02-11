import dagre from "dagre";
import SdfgNode from "./sdfgNode";
import SdfgEdge from "./sdfgEdge";

export default class SdfgGraph {
    public nodes: Array<SdfgNode>;
    public edges: Array<SdfgEdge>;

    constructor() {
        this.nodes = [];
        this.edges = [];
    }

    addNode(id: number, node: SdfgNode): void {
        this.nodes[id] = node;
    }

    addEdge(edge: SdfgEdge) {
        this.edges.push(edge);
    }

}