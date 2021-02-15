import dagre from "dagre";
import SdfgNode from "./sdfgNode";
import SdfgEdge from "./sdfgEdge";
import * as _ from "lodash";

export default class SdfgGraph {
    private _edges: Array<SdfgEdge>;
    private _nodes: Array<SdfgNode>;

    constructor() {
        this._nodes = [];
        this._edges = [];
    }

    addNode(node: SdfgNode, id: number = null): number {
        if (id === null) {
            id = this._nodes.length;
        }
        this._nodes[id] = node;
        return id;
    }

    addEdge(edge: SdfgEdge): number {
        const id = this._edges.length;
        edge.id = id;
        this._edges.push(edge);
        return id;
    }

    node(id: number): SdfgNode {
        return this._nodes[id];
    }

    removeNode(id: number): void {
        delete this._nodes[id];
    }

    removeEdge(id: number): void {
        delete this._edges[id];
    }

    get edges() {
        return _.compact(this._edges);
    }

    get nodes() {
        return _.compact(this._nodes);
    }
}