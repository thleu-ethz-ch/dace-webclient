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
        const nextIndex = this.nodes.length;
        this.nodes.push(node);
        node.group = this;
        node.index = nextIndex;
        return this.rank.orderGraph.addNode(node, id);
    }

    removeNode(node: OrderNode) {
        this.rank.orderGraph.removeNode(node.id);
        for (let i = node.index + 1; i < this.nodes.length; ++i) {
            this.nodes[i].index--;
        }
        _.pull(this.nodes, node);
    }

    orderNodes(): void {
        this.order = _.map(_.sortBy(_.map(this.nodes, (node, n) => {
            return {n: n, pos: node.position};
        }), "pos"), "n");
    }

    orderedNodes(): Array<OrderNode> {
        const nodes = [];
        if (this.order.length < this.nodes.length) {
            this.orderNodes();
        }
        console.log(this.order);
        _.forEach(this.order, pos => {
            nodes.push(this.nodes[pos]);
        });
        return nodes;
    }
}