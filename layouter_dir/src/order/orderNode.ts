import Graph from "../graph/graph";
import Node from "../graph/node";
import OrderEdge from "./orderEdge";
import OrderGroup from "./orderGroup";

export default class OrderNode extends Node<Graph<any, any>, OrderEdge>
{
    public readonly reference: any;
    public group: OrderGroup;
    public position: number = 0;

    constructor(reference: any, label: string = null) {
        super();
        this.label = label;
        this.reference = reference;
    }

}