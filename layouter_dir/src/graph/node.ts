import Graph from "./graph";
import Edge from "./edge";

export default class Node<GraphT extends Graph<any, any>, EdgeT extends Edge<any, any>> {
    public id: number;
    public graph: GraphT;
    public childGraph: GraphT = null;
    private _label: string = "";

    constructor(label: string = "") {
        this._label = label;
    }

    public label() {
        return this._label;
    }

    public setLabel(label: string = "") {
        this._label = label;
    }

    setChildGraph(childGraph: GraphT) {
        childGraph.parentNode = this;
        this.childGraph = childGraph;
    }

    parents(): Array<this> {
        const parents = [];
        let graph = this.graph;
        while (graph.parentNode !== null) {
            parents.push(graph.parentNode);
            graph = graph.parentNode.graph;
        }
        return parents;
    }
}
