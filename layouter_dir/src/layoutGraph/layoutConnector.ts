import * as _ from "lodash";
import LayoutNode from "./layoutNode";
import Box from "../geometry/box";
import Vector from "../geometry/vector";
import Size from "../geometry/size";

export default class LayoutConnector {
    public readonly node: LayoutNode;
    public readonly name: string;
    public readonly diameter: number;

    public isScoped: boolean = false;

    // position is relative to node
    public x = null;
    public y = null;
    public readonly width;
    public readonly height;

    constructor(node: LayoutNode, name: string, diameter: number) {
        this.node = node;
        this.name = name;
        this.diameter = diameter;
        this.width = diameter;
        this.height = diameter;
        if (name.startsWith("IN_")) {
            const matchingConnectorIndex = _.map(node.outConnectors, "name").indexOf("OUT_" + name.substr(3));
            if (matchingConnectorIndex > -1) {
                this.isScoped = true;
                node.outConnectors[matchingConnectorIndex].isScoped = true;
            }
        }
        if (name.startsWith("OUT_")) {
            const matchingConnectorIndex = _.map(node.inConnectors, "name").indexOf("IN_" + name.substr(4));
            if (matchingConnectorIndex > -1) {
                this.isScoped = true;
                node.inConnectors[matchingConnectorIndex].isScoped = true;
            }
        }
    }

    position(): Vector {
        return new Vector(this.x, this.y);
    }

    size(): Size {
        return {
            width: this.width,
            height: this.height,
        }
    }

    boundingBox(): Box {
        return new Box(this.x, this.y, this.width, this.height);
    }

    setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    translate(x: number, y: number): void {
        this.x += x;
        this.y += y;
    }
}