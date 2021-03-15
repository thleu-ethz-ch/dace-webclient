import * as _ from "lodash";
import Edge from "./edge";
import Node from "./node";

export default class Graph<NodeT extends Node<any, any>, EdgeT extends Edge<any, any>> {
    public parentNode: NodeT = null;

    protected _nodes: Array<NodeT>;
    protected _edges: Array<EdgeT>;
    protected _outEdges: Array<Array<number>>;
    protected _inEdges: Array<Array<number>>;

    public constructor() {
        this._init();
    }

    cloneEmpty() {
        const clone = _.clone(this);
        clone._init();
        return clone;
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

    hasEdge(srcId: number, dstId: number): boolean {
        const numOutEdges = this._outEdges[srcId].length;
        for (let i = 0; i < numOutEdges; ++i) {
            if (this._edges[this._outEdges[srcId][i]].dst === dstId) {
                return true;
            }
        }
        return false;
    }

    edgeBetween(srcId: number, dstId: number): EdgeT {
        const numOutEdges = this._outEdges[srcId].length;
        for (let i = 0; i < numOutEdges; ++i) {
            if (this._edges[this._outEdges[srcId][i]].dst === dstId) {
                return this._edges[this._outEdges[srcId][i]];
            }
        }
        return undefined;
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

    maxId(): number {
        return this._nodes.length - 1;
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

    allGraphs(): Array<this> {
        const allGraphs = [this];

        const addSubgraphs = (graph: this) => {
            _.forEach(graph.nodes(), (node: NodeT) => {
                if (node.childGraph !== null) {
                    allGraphs.push(node.childGraph);
                    addSubgraphs(node.childGraph);
                }
            });
        };
        addSubgraphs(this);

        return allGraphs;
    }

    outEdges(id: number): Array<EdgeT> {
        return _.map(this._outEdges[id], edgeId => this.edge(edgeId));
    }

    inEdges(id: number): Array<EdgeT> {
        return _.map(this._inEdges[id], edgeId => this.edge(edgeId));
    }

    clear() {
        this._init();
    }

    toposort(): Array<NodeT> {
        const sortedNodes = [];
        const predecessors = new Array(this._nodes.length);
        const queue = [];
        let queuePointer = 0;
        _.forEach(this._nodes, (node: NodeT, i: number) => {
            if (node === undefined) {
                return; // skip deleted nodes
            }
            const numInEdges = this.inEdges(node.id).length;
            predecessors[i] = numInEdges;
            if (numInEdges === 0) {
                queue.push(node);
            }
        });
        while (queuePointer < queue.length) {
            const node = queue[queuePointer++];
            sortedNodes.push(node);
            _.forEach(this.outEdges(node.id), (edge: EdgeT) => {
                predecessors[edge.dst]--;
                if (predecessors[edge.dst] === 0) {
                    queue.push(this.node(edge.dst));
                }
            });
        }
        return sortedNodes;
    }

    sources(): Array<NodeT> {
        return _.filter(this.nodes(), (node: NodeT) => {
            return (this.inEdges(node.id).length === 0);
        });
    }

    sinks(): Array<NodeT> {
        return _.filter(this.nodes(), (node: NodeT) => {
            return (this.outEdges(node.id).length === 0);
        });
    }

    /**
     * Returns an array of graphs where each graph is one connected component.
     * Fields of nodes and edges are cloned shallowly. IDs are preserved.
     */
    components(): Array<Graph<NodeT, EdgeT>> {
        const nodes = this.nodes();
        if (nodes.length === 0) {
            return [];
        }
        const componentNumbers = _.fill(new Array(this._nodes.length), null);
        let currentNumber = 0;
        _.forEach(nodes, (node: NodeT) => {
            if (componentNumbers[node.id] !== null) {
                return;
            }
            componentNumbers[node.id] = currentNumber;
            const queue = [node];
            let queuePointer = 0;
            while (queuePointer < queue.length) {
                const node = queue[queuePointer++];
                _.forEach(this.outEdges(node.id), (edge: EdgeT) => {
                    if (componentNumbers[edge.dst] === null) {
                        componentNumbers[edge.dst] = currentNumber;
                        queue.push(this.node(edge.dst));
                    }
                });
                _.forEach(this.inEdges(node.id), (edge: EdgeT) => {
                    if (componentNumbers[edge.src] === null) {
                        componentNumbers[edge.src] = currentNumber;
                        queue.push(this.node(edge.src));
                    }
                });
            }
            currentNumber++;
        });
        const components = [];
        // create component graphs
        for (let i = 0; i < currentNumber; ++i) {
            components.push(this.cloneEmpty());
        }
        // add nodes
        _.forEach(nodes, (node: NodeT) => {
            const componentId = componentNumbers[node.id];
            components[componentId].addNode(node, node.id);
            node.graph = this;
        });
        // add edges
        _.forEach(nodes, (node: NodeT) => {
            _.forEach(this.outEdges(node.id), (edge: EdgeT) => {
                const componentId = componentNumbers[node.id];
                components[componentId].addEdge(edge, edge.id);
                edge.graph = this;
            });
        });

        return components;
    }

    private _init() {
        this._nodes = [];
        this._edges = [];
        this._outEdges = [];
        this._inEdges = [];
    }
}