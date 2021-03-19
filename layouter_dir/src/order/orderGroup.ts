import Graph from "../graph/graph";
import Node from "../graph/node";
import OrderNode from "./orderNode";
import OrderRank from "./orderRank";
import Edge from "../graph/edge";
import * as _ from "lodash";

export default class OrderGroup extends Node<Graph<any, any>, Edge<any, any>>
{
    public readonly reference: any;
    public readonly isFixed: boolean;
    public nodes: Array<OrderNode> = [];

    public order: Array<number> = [];
    public position: number = 0;
    public rank: OrderRank;

    constructor(reference: any, isFixed: boolean = false) {
        super();
        this.reference = reference;
        this.isFixed = isFixed;
    }

    addNode(node: OrderNode, id: number = null): number {
        this.nodes.push(node);
        node.group = this;
        return this.rank.orderGraph.addNode(node, id);
    }

    orderedNodes(): Array<OrderNode> {
        const nodes = [];
        _.forEach(this.order, pos => {
            nodes.push(this.nodes[pos]);
        });
        return nodes;
    }
}