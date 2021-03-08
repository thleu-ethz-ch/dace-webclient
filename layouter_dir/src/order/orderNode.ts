import Graph from "../graph/graph";
import Node from "../graph/node";
import OrderEdge from "./orderEdge";
import OrderGroup from "./orderGroup";

export default class OrderNode extends Node<Graph<any, any>, OrderEdge>
{
    public readonly reference: any;
    public group: OrderGroup = null;

    constructor(reference: any) {
        super();
        this.reference = reference;
    }

}