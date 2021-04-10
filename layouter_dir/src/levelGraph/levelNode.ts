import Node from "../graph/node";
import LevelGraph from "./levelGraph";
import Edge from "../graph/edge";
import LayoutNode from "../layoutGraph/layoutNode";

export default class LevelNode extends Node<LevelGraph, Edge<any, any>>
{
    public rank: number = null;
    public position: number = null;
    public width: number = null;
    public x: number = null;

    public readonly layoutNode: LayoutNode;
    public readonly isFirst: boolean;

    constructor(layoutNode: LayoutNode, rank: number, isFirst: boolean = false) {
        super(layoutNode.label());
        this.layoutNode = layoutNode;
        this.rank = rank;
        this.width = layoutNode.width;
        this.isFirst = isFirst;
    }
}