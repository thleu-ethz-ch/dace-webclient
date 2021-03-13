import Graph from "../graph/graph";
import Node from "../graph/node";
import OrderEdge from "./orderEdge";
import OrderGraph from "./orderGraph";
import OrderNode from "./orderNode";
import OrderRank from "./orderRank";
import Edge from "../graph/edge";

export default class OrderGroup extends Node<Graph<any, any>, Edge<any, any>>
{
    public readonly reference: any;
    public readonly isFixed: boolean;
    public readonly nodes: Array<OrderNode> = [];

    public order: Array<number>;
    public rank: OrderRank;

    constructor(reference: any, isFixed: boolean = false) {
        super();
        this.reference = reference;
        this.isFixed = isFixed;
    }

    addNode(node: OrderNode): number {
        this.nodes.push(node);
        node.group = this;
        return this.rank.orderGraph.addNode(node);
    }
}