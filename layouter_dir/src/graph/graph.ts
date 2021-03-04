import * as _ from "lodash";
import Edge from "./edge";
import Node from "./node";

export default class Graph<NodeT extends Node<any, any>, EdgeT extends Edge<any, any>> {
    public parentNode: NodeT = null;

    protected readonly _nodes: Array<NodeT>;
    protected readonly _edges: Array<EdgeT>;
    protected readonly _outEdges: Array<Array<number>>;
    protected readonly _inEdges: Array<Array<number>>;

    public constructor() {
        this._nodes = [];
        this._edges = [];
        this._outEdges = [];
        this._inEdges = [];
    }

    addNode(node: NodeT, id: number = null): number {
        if (id === null) {
            id = this._nodes.length;
        }
        node.id = id;
        node.graph = this;
        this._nodes[id] = node;
        this._outEdges[id] = [];
        this._inEdges[id] = [];
        return id;
    }

    addEdge(edge: EdgeT, id: number = null): number {
        if (id === null) {
            id = this._edges.length;
        }
        edge.id = id;
        edge.graph = this;
        this._edges[id] = edge;
        this._outEdges[edge.src].push(id);
        this._inEdges[edge.dst].push(id);
        return id;
    }

    node(id: number): NodeT {
        return this._nodes[id];
    }

    edge(id: number): EdgeT {
        return this._edges[id];
    }

    removeNode(id: number): void {
        this._nodes[id] = null;
    }

    removeEdge(id: number): void {
        const edge = this.edge(id);
        _.pull(this._outEdges[edge.src], id);
        _.pull(this._inEdges[edge.dst], id);
        this._edges[id] = null;
    }

    nodes(): Array<NodeT> {
        return _.compact(this._nodes);
    }

    allNodes(): Array<NodeT> {
        const allNodes = [];

        const addNodesForGraph = (graph: this) => {
            _.forEach(graph.nodes(), (node: NodeT) => {
                allNodes.push(node);
                if (node.childGraph !== null) {
                    addNodesForGraph(node.childGraph);
                }
            });
        };
        addNodesForGraph(this);

        return allNodes;
    }

    edges(): Array<EdgeT> {
        return _.compact(this._edges);
    }

    allEdges(): Array<EdgeT> {
        const allEdges = [];

        const addEdgesForGraph = (graph: this) => {
            _.forEach(graph.edges(), (edge: EdgeT) => {
                allEdges.push(edge);
            });
            _.forEach(graph.nodes(), (node: NodeT) => {
                if (node.childGraph !== null) {
                    addEdgesForGraph(node.childGraph);
                }
            });
        };
        addEdgesForGraph(this);

        return allEdges;
    }

    outEdges(id: number): Array<EdgeT> {
        return _.map(this._outEdges[id], edgeId => this.edge(edgeId));
    }

    inEdges(id: number): Array<EdgeT> {
        return _.map(this._inEdges[id], edgeId => this.edge(edgeId));
    }

    elements(): Array<any> {
        return [].concat(this.nodes(), this.edges());
    }
}