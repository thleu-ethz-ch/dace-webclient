import Graph from "../graph/graph";
import Node from "../graph/node";
import OrderEdge from "./orderEdge";
import OrderGroup from "./orderGroup";

export default class OrderNode extends Node<Graph<any, any>, OrderEdge>
{
    public reference: any;
    public group: OrderGroup;
    public position: number = 0;
    public index: number = 0; // the index within the group, used as an id, changes only when another node is removed
    public rank: number = 0;
    public readonly isVirtual: boolean;

    constructor(reference: any, isVirtual: boolean, label: string = "") {
        super(label);
        this.reference = reference;
        this.isVirtual = isVirtual;
    }

}