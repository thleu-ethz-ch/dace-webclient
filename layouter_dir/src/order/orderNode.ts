import Graph from "../graph/graph";
import Node from "../graph/node";
import OrderEdge from "./orderEdge";
import OrderGroup from "./orderGroup";

export default class OrderNode extends Node<Graph<any, any>, OrderEdge>
{
    public reference: any;
    public group: OrderGroup;
    public position: number = 0;
    public index: number = 0;
    public rank: number = 0;
    public initialRank: number = 0;

    constructor(reference: any, label: string = "") {
        super(label);
        this.reference = reference;
    }

}