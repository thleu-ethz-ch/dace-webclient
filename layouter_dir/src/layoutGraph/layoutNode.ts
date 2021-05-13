import Box from "../geometry/box";
import Node from "../graph/node";
import Size from "../geometry/size";
import LayoutConnector from "./layoutConnector";
import LayoutEdge from "./layoutEdge";
import Vector from "../geometry/vector";
import LayoutGraph from "./layoutGraph";
import * as _ from "lodash";
import LayoutBundle from "./layoutBundle";
import LevelNode from "../levelGraph/levelNode";

export default class LayoutNode extends Node<LayoutGraph, LayoutEdge> {
    public inConnectors: Array<LayoutConnector> = [];
    public outConnectors: Array<LayoutConnector> = [];
    public inConnectorBundles: Array<LayoutBundle> = [];
    public outConnectorBundles: Array<LayoutBundle> = [];
    public bottomInConnectorIndex = null;
    public topOutConnectorIndex = null;

    public x: number = 0;
    public y: number = 0;
    public width: number = 0;
    public height: number = 0;

    public selfLoop: LayoutEdge = null;

    public isAccessNode: boolean = false;
    public isScopeNode: boolean = false;
    public hasScopedConnectors: boolean = false;
    public rank: number = null; // global rank (level) of the node
    public rankSpan: number = 1;
    public index: number = 0; // index of the node, when indexes is set, it should eventually be the max index

    public levelNodes: Array<LevelNode> = [];

    public readonly childGraphs: Array<LayoutGraph> = [];

    public readonly padding: number = 0;
    public readonly isVirtual: boolean = false;
    public readonly isBundle: boolean = false;

    private readonly _inConnectors: Map<string, LayoutConnector> = new Map();
    private readonly _outConnectors: Map<string, LayoutConnector> = new Map();

    constructor(size: Size = null, padding: number = 0, isVirtual: boolean = false, isBundle: boolean = false) {
        super();
        if (size !== null) {
            this.width = size.width;
            this.height = size.height;
        }
        this.padding = padding;
        this.isVirtual = isVirtual;
    }

    connector(type: "IN" | "OUT", name: string): LayoutConnector {
        if (type === "IN") {
            return this._inConnectors.get(name);
        } else {
            return this._outConnectors.get(name);
        }
    }

    addConnector(type: "IN" | "OUT", name: string, diameter: number) {
        const connector = new LayoutConnector(this, type, name, diameter);
        if (type === "IN") {
            this._inConnectors.set(name, connector);
            this.inConnectors.push(connector);
        } else {
            this._outConnectors.set(name, connector);
            this.outConnectors.push(connector);
        }
    }

    translate(x: number, y: number) {
        this.x += x;
        this.y += y;
        _.forEach(this.childGraphs, (childGraph: LayoutGraph) => {
            childGraph.translateElements(x, y);
        });
        _.forEach(this.inConnectors, (connector: LayoutConnector) => {
            connector.translate(x, y);
        });
        _.forEach(this.outConnectors, (connector: LayoutConnector) => {
            connector.translate(x, y);
        });
        _.forEach(this.inConnectorBundles, (inBundle: LayoutBundle) => {
            inBundle.x += x;
            inBundle.y += y;
        });
        _.forEach(this.outConnectorBundles, (outBundle: LayoutBundle) => {
            outBundle.x += x;
            outBundle.y += y;
        });
    }

    translateWithoutChildren(x: number, y: number) {
        this.x += x;
        this.y += y;
        _.forEach(this.inConnectors, (connector: LayoutConnector) => {
            connector.translate(x, y);
        });
        _.forEach(this.outConnectors, (connector: LayoutConnector) => {
            connector.translate(x, y);
        });
    }

    setPosition(position: Vector) {
        this.x = position.x;
        this.y = position.y;
    }

    updatePosition(position: Vector) {
        const prevX = this.x;
        const prevY = this.y;
        const offsetX = position.x - prevX;
        const offsetY = position.y - prevY;
        this.x = position.x;
        this.y = position.y;
        _.forEach(this.childGraphs, (childGraph: LayoutGraph) => {
            childGraph.translateElements(offsetX, offsetY);
        });
    }

    setSize(size: Size) {
        this.width = size.width;
        this.height = size.height;
    }

    updateSize(size: Size) {
        this.width = Math.max(this.width, size.width);
        this.height = Math.max(this.height, size.height);
    }

    setWidth(width: number) {
        this.width = width;
    }

    position(): Vector {
        return (new Vector(this.x, this.y));
    }

    size(): Size {
        return {
            width: this.width,
            height: this.height,
        };
    }

    boundingBox(): Box {
        return new Box(this.x, this.y, this.width, this.height);
    }

    offsetRank(offset: number) {
        this.rank += offset;
        if (offset !== 0) {
            _.forEach(this.childGraphs, (childGraph) => {
                childGraph.offsetRank(offset);
            });
            _.forEach(this.levelNodes, (levelNode: LevelNode, r: number) => {
                levelNode.rank = this.rank + r;
            });
        }
    }

    updateRank(newRank: number) {
        if (this.rank !== newRank) {
            this.offsetRank(newRank - this.rank);
        }
    }

}

