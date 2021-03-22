import * as _ from "lodash";
import Edge from "./edge";
import Node from "./node";
import Component from "./component";
import Assert from "../util/assert";
import LayoutNode from "../layoutGraph/layoutNode";

export default class Graph<NodeT extends Node<any, any>, EdgeT extends Edge<any, any>> {
    public parentNode: NodeT = null;

    protected _nodes: Array<NodeT>;
    protected _edges: Array<EdgeT>;
    protected _outEdges: Array<Array<number>>;
    protected _inEdges: Array<Array<number>>;

    private _components;

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
        this._components = null;
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
        this._components = null;
        return id;
    }

    invertEdge(edgeId: number): void {
        const edge = this._edges[edgeId];
        _.pull(this._outEdges[edge.src], edgeId);
        _.pull(this._inEdges[edge.dst], edgeId);
        const tmpSrc = edge.src;
        edge.src = edge.dst;
        edge.dst = tmpSrc;
        this._outEdges[edge.src].push(edgeId);
        this._inEdges[edge.dst].push(edgeId);
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
        this._nodes[id] = undefined;
        this._components = null;
    }

    removeEdge(id: number): void {
        const edge = this.edge(id);
        _.pull(this._outEdges[edge.src], id);
        _.pull(this._inEdges[edge.dst], id);
        this._edges[id] = undefined;
        this._components = null;
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

    hasCycle(): boolean {
        return (this.toposort().length < this.nodes().length);
    }

    removeCycles(): Array<EdgeT> {
        const invertedEdges = [];
        const remainingNodes = new Set();
        const predecessors = new Array(this._nodes.length);
        const queue = [];
        let queuePointer = 0;
        _.forEach(this._nodes, (node: NodeT) => {
            if (node === undefined) {
                return; // skip removed nodes
            }
            const numInEdges = this.inEdges(node.id).length;
            predecessors[node.id] = numInEdges;
            if (numInEdges === 0) {
                queue.push(node);
            } else {
                remainingNodes.add(node.id);
            }
        });
        while (remainingNodes.size > 0) {
            // toposort
            while (queuePointer < queue.length) {
                const node = queue[queuePointer++];
                _.forEach(this.outEdges(node.id), (edge: EdgeT) => {
                    predecessors[edge.dst]--;
                    if (predecessors[edge.dst] === 0) {
                        queue.push(this.node(edge.dst));
                    }
                });
            }

            // no nodes without in-edges => either finished or halting before cycle

            if (remainingNodes.size > 0) {
                const nextNodeId = remainingNodes.values().next().value;
                const nextNode = this.node(nextNodeId); // first remaining node
                _.forEach(this.inEdges(nextNode.id), (inEdge: EdgeT) => {
                    this.invertEdge(inEdge.id);
                    invertedEdges.push(this._edges[inEdge.id]);
                });
                remainingNodes.delete(nextNode.id);
                queue.push(nextNode);
            }
        }

        return invertedEdges;
    }

    toposort(): Array<NodeT> {
        const sortedNodes = [];
        const predecessors = new Array(this._nodes.length);
        const queue = [];
        let queuePointer = 0;
        _.forEach(this._nodes, (node: NodeT) => {
            if (node === undefined) {
                return; // skip deleted nodes
            }
            const numInEdges = this.inEdges(node.id).length;
            predecessors[node.id] = numInEdges;
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

    components(): Array<Component<NodeT, EdgeT>> {
        //if (this._components === null) {
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

            this._components = [];
            // create components
            for (let i = 0; i < currentNumber; ++i) {
                this._components.push(this._createComponent());
            }
            // add nodes
            _.forEach(nodes, (node: NodeT) => {
                const componentId = componentNumbers[node.id];
                this._components[componentId].addNode(node.id);
            });
            // add edges
            _.forEach(nodes, (node: NodeT) => {
                _.forEach(this.outEdges(node.id), (edge: EdgeT) => {
                    const componentId = componentNumbers[node.id];
                    this._components[componentId].addEdge(edge.id);
                });
            });
        //}

        const nodeSet = new Set();
        _.forEach(this._components, component => {
            _.forEach(component.nodes(), node => {
                Assert.assert(!nodeSet.has(node), "NODE IN MULTIPLE COMPONENTS", this._components);
                nodeSet.add(node);
            });
        });

        return this._components;
    }

    toString(): string {
        const subgraphToObj = (subgraph: Graph<NodeT, EdgeT>) => {
            const obj = {
                nodes: {},
                edges: [],
            };
            _.forEach(subgraph.nodes(), (node: NodeT) => {
                obj.nodes[node.id] = {
                    label: node.label,
                    child: node.childGraph !== null ? subgraphToObj(node.childGraph) : null
                };
            });
            _.forEach(subgraph.edges(), (edge: EdgeT) => {
                obj.edges.push({src: edge.src, dst: edge.dst, weight: edge.weight});
            });
            return obj;
        };
        return JSON.stringify(subgraphToObj(this));
    }

    storeLocal() {
        if (typeof window !== "undefined") {
            window.localStorage.setItem("storedGraph", this.toString());
        }
    }

    protected _createComponent(): Component<NodeT, EdgeT> {
        return new Component(this);
    }

    private _init() {
        this._nodes = [];
        this._edges = [];
        this._outEdges = [];
        this._inEdges = [];
        this._components = null;
    }
}