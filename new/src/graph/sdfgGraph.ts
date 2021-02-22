import * as _ from "lodash";
import SdfgEdge from "./sdfgEdge";
import SdfgNode from "./sdfgNode";
import Shape from "../layout/shape";
import BoundingBox from "../layout/boundingBox";

export default class SdfgGraph {
    private readonly _edges: Array<SdfgEdge>;
    private readonly _nodes: Array<SdfgNode>;

    constructor() {
        this._nodes = [];
        this._edges = [];
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
        this._nodes[id] = node;
        return id;
    }

    addEdge(edge: SdfgEdge): number {
        const id = this._edges.length;
        edge.id = id;
        edge.graph = this;
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

    edges() {
        return _.compact(this._edges);
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