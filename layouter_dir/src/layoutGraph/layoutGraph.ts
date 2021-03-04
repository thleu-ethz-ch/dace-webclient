import * as _ from "lodash";
import Box from "../geometry/box";
import Graph from "../graph/graph";
import LayoutNode from "./layoutNode";
import LayoutEdge from "./layoutEdge";

export default class LayoutGraph extends Graph<LayoutNode, LayoutEdge> {
    public entryNode: LayoutNode = null;
    public exitNode: LayoutNode = null;
    public readonly mayHaveCycles: boolean;

    constructor(mayHaveCycles: boolean = false) {
        super();
        this.mayHaveCycles = mayHaveCycles;
    }

    translateElements(x: number, y: number) {
        _.forEach(this.nodes(), (node: LayoutNode) => {
            node.translate(x, y);
        });
        _.forEach(this.edges(), (edge: LayoutEdge) => {
            edge.translate(x, y);
        });
    }

    boundingBox(): Box {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this.nodes(), (node: LayoutNode) => {
            const box = node.boundingBox();
            minX = Math.min(minX, box.x);
            maxX = Math.max(maxX, box.x + box.width);
            minY = Math.min(minY, box.y);
            maxY = Math.max(maxY, box.y + box.height);
        });
        _.forEach(this.edges(), (edge: LayoutEdge) => {
            const box = edge.boundingBox();
            minX = Math.min(minX, box.x);
            maxX = Math.max(maxX, box.x + box.width);
            minY = Math.min(minY, box.y);
            maxY = Math.max(maxY, box.y + box.height);
        });
        return new Box(minX, minY, maxX - minX, maxY - minY);
    }
}
