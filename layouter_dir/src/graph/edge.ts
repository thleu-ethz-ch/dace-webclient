import Graph from "./graph";
import Node from "./node";

export default class Edge<GraphT extends Graph<any, any>, NodeT extends Node<any, any>> {
    public id: number;
    public graph: GraphT;
    public readonly src: number;
    public readonly dst: number;

    constructor(src: number, dst: number) {
        this.src = src;
        this.dst = dst;
    }

    parents(): Array<NodeT> {
        const parents = [];
        let graph = this.graph;
        while (graph.parentNode !== null) {
            parents.push(graph.parentNode);
            graph = graph.parentNode.graph;
        }
        return parents;
    }
}