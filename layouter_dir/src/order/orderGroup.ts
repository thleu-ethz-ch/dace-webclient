import Graph from "../graph/graph";
import Node from "../graph/node";
import OrderNode from "./orderNode";
import OrderRank from "./orderRank";
import Edge from "../graph/edge";
import * as _ from "lodash";

export default class OrderGroup extends Node<Graph<any, any>, Edge<any, any>>
{
    public readonly reference: any;
    public nodes: Array<OrderNode> = [];

    public order: Array<number> = [];
    public position: number = 0;
    public rank: OrderRank;

    constructor(reference: any, label: string = null) {
        super(label);
        this.reference = reference;
    }

    addNode(node: OrderNode, id: number = null): number {
        this.nodes.push(node);
        node.group = this;
        return this.rank.orderGraph.addNode(node, id);
    }

    orderedNodes(): Array<OrderNode> {
        const nodes = [];
        if (this.order.length < this.nodes.length) {
            this.order = _.map(_.sortBy(_.map(this.nodes, (node, n) => {
                return {n: n, pos: node.position};
            }), "pos"), "n");
        }
        _.forEach(this.order, pos => {
            nodes.push(this.nodes[pos]);
        });
        return nodes;
    }
}