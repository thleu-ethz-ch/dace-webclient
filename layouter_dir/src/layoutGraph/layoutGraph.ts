import * as _ from "lodash";
import Box from "../geometry/box";
import Graph from "../graph/graph";
import LayoutComponent from "./layoutComponent";
import LayoutEdge from "./layoutEdge";
import LayoutNode from "./layoutNode";
import {CONNECTOR_SIZE} from "../util/constants";

export default class LayoutGraph extends Graph<LayoutNode, LayoutEdge> {
    public readonly mayHaveCycles: boolean;

    public entryNode: LayoutNode = null;
    public exitNode: LayoutNode = null;

    public minRank = 0;
    public maxRank = 0;

    private _ranks = null;
    public readonly removedEdges: Map<string, Set<LayoutEdge>> = new Map();

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

    boundingBox(includeEdges: boolean = true): Box {
        const nodes = this.nodes();
        if (nodes.length === 0) {
            return new Box(0, 0, 0, 0);
        }
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(nodes, (node: LayoutNode) => {
            const box = node.boundingBox();
            if (node.outConnectors.length > 0) {
                box.height += CONNECTOR_SIZE / 2;
            }
            minX = Math.min(minX, box.x);
            maxX = Math.max(maxX, box.x + box.width);
            minY = Math.min(minY, box.y);
            maxY = Math.max(maxY, box.y + box.height);
        });
        if (includeEdges) {
            _.forEach(this.edges(), (edge: LayoutEdge) => {
                const box = edge.boundingBox();
                minX = Math.min(minX, box.x);
                maxX = Math.max(maxX, box.x + box.width);
                minY = Math.min(minY, box.y);
                maxY = Math.max(maxY, box.y + box.height);
            });
        }
        return new Box(minX, minY, maxX - minX, maxY - minY);
    }

    public globalRanks(): Array<Array<LayoutNode>> {
        const nodesPerRank = new Array(this.maxRank + 1);
        for (let r = 0; r <= this.maxRank; ++r) {
            nodesPerRank[r] = [];
        }
        _.forEach(this.allNodes(), (node: LayoutNode) => {
            nodesPerRank[node.rank].push(node);
        });
        return nodesPerRank;
    }

    public updateRank(newRank: number): void {
        const offset = newRank - this.minRank;
        this.minRank += offset;
        this.maxRank += offset;
        _.forEach(this.nodes(), node => {
            node.updateRank(node.rank + offset);
        });
    }

    public maxIndex(): number {
        let maxIndex = 0;
        _.forEach(this.nodes(), (node: LayoutNode) => {
            maxIndex = Math.max(maxIndex, node.index);
        });
        return maxIndex;
    }

    protected _createComponent(): LayoutComponent {
        return new LayoutComponent(this);
    }
}
