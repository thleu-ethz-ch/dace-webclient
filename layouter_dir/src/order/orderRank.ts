import * as _ from "lodash";
import Edge from "../graph/edge";
import Graph from "../graph/graph";
import Node from "../graph/node";
import OrderGraph from "./orderGraph";
import OrderGroup from "./orderGroup";

export default class OrderRank extends Node<Graph<any, any>, Edge<any, any>>
{
    public readonly groups: Array<OrderGroup> = [];

    public order: Array<number>;
    public orderGraph: OrderGraph;

    constructor() {
        super();
    }

    orderGroups(): void {
        this.order = _.map(_.sortBy(_.map(this.groups, (group, n) => {
            return {n: n, pos: group.position};
        }), "pos"), "n");
    }

    orderedGroups(): Array<OrderGroup> {
        const groups = [];
        _.forEach(this.order, pos => {
            groups.push(this.groups[pos]);
        });
        return groups;
    }

    addGroup(group: OrderGroup, id: number = null): number {
        group.rank = this;
        this.groups.push(group);
        return this.orderGraph.addGroup(group, id);
    }
}