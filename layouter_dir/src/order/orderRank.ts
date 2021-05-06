import * as _ from "lodash";
import Edge from "../graph/edge";
import Graph from "../graph/graph";
import Node from "../graph/node";
import OrderGraph from "./orderGraph";
import OrderGroup from "./orderGroup";
import Assert from "../util/assert";

export default class OrderRank extends Node<Graph<any, any>, Edge<any, any>>
{
    public readonly groups: Array<OrderGroup> = [];

    public order: Array<number> = [];
    public orderGraph: OrderGraph;
    public rank: number;

    constructor(rank: number = null) {
        super();
        this.rank = rank;
    }

    orderGroups(): void {
        this.order = _.map(_.sortBy(_.map(this.groups, (group, n) => {
            return {n: n, pos: group.position};
        }), "pos"), "n");
        Assert.assertEqual(_.map(this.groups, group => group.index), _.range(this.groups.length), "group indizes corrupt");
    }

    orderedGroups(): Array<OrderGroup> {
        const groups = [];
        if (this.order.length !== this.groups.length) {
            this.orderGroups();
        }
        _.forEach(this.order, pos => {
            groups.push(this.groups[pos]);
        });
        Assert.assertEqual(_.map(this.groups, group => group.index), _.range(this.groups.length), "group indizes corrupt");
        return groups;
    }

    addGroup(group: OrderGroup, id: number = null): number {
        const nextIndex = this.groups.length;
        this.groups.push(group);
        group.index = nextIndex;
        group.rank = this;
        Assert.assertEqual(_.map(this.groups, group => group.index), _.range(this.groups.length), "group indizes corrupt");
        return this.orderGraph.addGroup(group, id);
    }
}