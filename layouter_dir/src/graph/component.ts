import Edge from "./edge";
import Graph from "./graph";
import Node from "./node";
import * as _ from "lodash";

export default class Component<NodeT extends Node<any, any>, EdgeT extends Edge<any, any>>
{
    protected readonly _nodeIds: Array<number> = [];
    protected readonly _edgeIds: Array<number> = [];
    protected readonly _graph: Graph<NodeT, EdgeT>;

    private _maxId: number = null;

    constructor(graph: Graph<NodeT, EdgeT>) {
        this._graph = graph;
    }

    public addNode(id: number) {
        this._nodeIds.push(id);
    }

    public addEdge(id: number) {
        this._edgeIds.push(id);
    }

    public node(id: number): NodeT {
        return this._graph.node(id);
    }

    public nodes(): Array<NodeT> {
        const nodes = [];
        _.forEach(this._nodeIds, id => {
            nodes.push(this._graph.node(id));
        });
        return nodes;
    }

    public edges(): Array<EdgeT> {
        const edges = [];
        _.forEach(this._edgeIds, id => {
            edges.push(this._graph.edge(id));
        });
        return edges;
    }

    public inEdges(id: number): Array<EdgeT> {
        return this._graph.inEdges(id);
    }

    public outEdges(id: number): Array<EdgeT> {
        return this._graph.outEdges(id);
    }

    public sources(): Array<NodeT> {
        return _.filter(this.nodes(), (node: NodeT) => {
            return (this._graph.inEdges(node.id).length === 0);
        });
    }

    public sinks(): Array<NodeT> {
        return _.filter(this.nodes(), (node: NodeT) => {
            return (this._graph.outEdges(node.id).length === 0);
        });
    }

    public bfs(startId: number = null, undirected: boolean = false): Array<NodeT> {
        const nodes = this.nodes();
        if (nodes.length === 0) {
            return [];
        }

        const sortedNodes = [];
        const visited = _.fill(new Array(this.maxId() + 1), false);
        const queue = [];
        let queuePointer = 0;
        if (startId === null) {
            queue.push(nodes[0]);
            visited[nodes[0].id] = true;
        } else {
            queue.push(this._graph.node(startId));
            visited[startId] = true;
        }
        while (queuePointer < queue.length) {
            const node = queue[queuePointer++];
            sortedNodes.push(node);
            _.forEach(this.outEdges(node.id), (outEdge: EdgeT) => {
                if (!visited[outEdge.dst]) {
                    queue.push(this._graph.node(outEdge.dst));
                    visited[outEdge.dst] = true;
                }
            });
            if (undirected) {
                _.forEach(this.outEdges(node.id), (outEdge: EdgeT) => {
                    if (!visited[outEdge.src]) {
                        queue.push(this._graph.node(outEdge.dst));
                        visited[outEdge.src] = true;
                    }
                });
            }
        }
        return sortedNodes;
    }
    public bfsUndirected(startId: number = null): Array<NodeT> {
        const nodes = this.nodes();
        if (nodes.length === 0) {
            return [];
        }

        const sortedNodes = [];
        const visited = _.fill(new Array(this.maxId() + 1), false);
        const queue = [];
        let queuePointer = 0;
        if (startId === null) {
            queue.push(nodes[0]);
            visited[nodes[0].id] = true;
        } else {
            console.assert(nodes[startId] !== undefined);
            queue.push(this._graph.node(startId));
            visited[startId] = true;
        }
        while (queuePointer < queue.length) {
            const node = queue[queuePointer++];
            sortedNodes.push(node);
            _.forEach(this.outEdges(node.id), (outEdge: EdgeT) => {
                if (!visited[outEdge.dst]) {
                    queue.push(this._graph.node(outEdge.dst));
                    visited[outEdge.dst] = true;
                }
            });

        }
        return sortedNodes;
    }

    public toposort(): Array<NodeT>
    {
        const sortedNodes = [];
        const predecessors = new Array(this.maxId());
        const queue = [];
        let queuePointer = 0;
        _.forEach(this._nodeIds, (nodeId: number) => {
            const numInEdges = this._graph.inEdges(nodeId).length;
            predecessors[nodeId] = numInEdges;
            if (numInEdges === 0) {
                queue.push(nodeId);
            }
        });
        while (queuePointer < queue.length) {
            const nodeId = queue[queuePointer++];
            sortedNodes.push(this._graph.node(nodeId));
            _.forEach(this._graph.outEdges(nodeId), (edge: EdgeT) => {
                predecessors[edge.dst]--;
                if (predecessors[edge.dst] === 0) {
                    queue.push(edge.dst);
                }
            });
        }
        return sortedNodes;
    }

    public maxId(): number {
        if (this._maxId === null) {
            this._maxId = 0;
            _.forEach(this._nodeIds, (nodeId: number) => {
                this._maxId = Math.max(this._maxId, nodeId);
            });
        }
        return this._maxId;
    }
}