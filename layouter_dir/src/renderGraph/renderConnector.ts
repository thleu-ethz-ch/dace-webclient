import RenderNode from "./renderNode";

export default class RenderConnector {
    public static DIAMETER = 10;
    public static PADDING = 20;
    public static MARGIN = 10;

    public name: string;
    public node: RenderNode;

    public x: number;
    public y: number;
    public width: number;
    public height: number;

    constructor(name: string, node: RenderNode) {
        this.name = name;
        this.node = node;
        this.width = RenderConnector.DIAMETER;
        this.height = RenderConnector.DIAMETER;
    }
}
