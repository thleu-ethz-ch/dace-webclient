import RenderNode from "./renderNode";
import {CONNECTOR_SIZE} from "../util/constants";

export default class RenderConnector {
    public name: string;
    public node: RenderNode;

    public x: number;
    public y: number;
    public width: number;
    public height: number;

    constructor(name: string, node: RenderNode) {
        this.name = name;
        this.node = node;
        this.width = CONNECTOR_SIZE;
        this.height = CONNECTOR_SIZE;
    }
}
