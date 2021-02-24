import * as _ from "lodash";
import SdfgEdge from "./sdfgEdge";
import SdfgNode from "./sdfgNode";
import Shape from "../layout/shape";
import BoundingBox from "../layout/boundingBox";

export default class SdfgGraph {
    private readonly _edges: Array<SdfgEdge>;
    private readonly _nodes: Array<SdfgNode>;
    private readonly _outEdges: Array<Array<number>>;
    private readonly _inEdges: Array<Array<number>>;

    constructor() {
        this._nodes = [];
        this._edges = [];
        this._outEdges = [];
        this._inEdges = [];
    }

    offsetChildren(x: number, y: number) {
        _.forEach(this.nodes(), (node: SdfgNode) => {
            node.offset(x, y);
        });
        _.forEach(this.edges(), (edge: SdfgEdge) => {
            edge.offset(x, y);
        });
    }

    addNode(node: SdfgNode, id: number = null): number {
        if (id === null) {
            id = this._nodes.length;
        }
        node.id = id;
        node.graph = this;
        this._nodes[id] = node;
        this._inEdges[id] = [];
        this._outEdges[id] = [];
        return id;
    }

    addEdge(edge: SdfgEdge, id: number = null): number {
        if (id === null) {
            id = this._edges.length;
        }
        edge.id = id;
        edge.graph = this;
        this._edges.push(edge);
        this._inEdges[edge.dst].push(id);
        this._outEdges[edge.src].push(id);
        return id;
    }

    node(id: number): SdfgNode {
        return this._nodes[id];
    }

    edge(id: number): SdfgEdge {
        return this._edges[id];
    }

    removeNode(id: number): void {
        delete this._nodes[id];
    }

    removeEdge(id: number): void {
        delete this._edges[id];
    }

    edges() {
        return _.compact(this._edges);
    }

    inEdges(id: number): Array<number> {
        return this._inEdges[id];
    }

    outEdges(id: number): Array<number> {
        return this._outEdges[id];
    }

    nodes() {
        return _.compact(this._nodes);
    }

    boundingBox(): BoundingBox {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this.nodes(), (node: SdfgNode) => {
            const box = node.boundingBox();
            minX = Math.min(minX, box.x);
            maxX = Math.max(maxX, box.x + box.width);
            minY = Math.min(minY, box.y);
            maxY = Math.max(maxY, box.y + box.height);
        });
        _.forEach(this.edges(), (edge: SdfgEdge) => {
            const box = edge.boundingBox();
            minX = Math.min(minX, box.x);
            maxX = Math.max(maxX, box.x + box.width);
            minY = Math.min(minY, box.y);
            maxY = Math.max(maxY, box.y + box.height);
        });
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    shapes(): Array<Shape> {
        const shapes = [];
        _.forEach(this.nodes(), (node) => {
            _.forEach(node.shapes(), (shape) => {
                shapes.push(shape);
            });
        });
        _.forEach(this.edges(), (edge) => {
            shapes.push(edge.shape());
        });
        return shapes;
    }
}