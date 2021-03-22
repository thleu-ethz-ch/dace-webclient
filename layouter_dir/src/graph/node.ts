import Graph from "./graph";
import Edge from "./edge";

export default class Node<GraphT extends Graph<any, any>, EdgeT extends Edge<any, any>> {
    public id: number;
    public graph: GraphT;
    public childGraph: GraphT = null;
    public label: string = "";

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
