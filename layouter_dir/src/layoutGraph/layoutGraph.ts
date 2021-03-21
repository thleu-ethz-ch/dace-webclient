import * as _ from "lodash";
import Box from "../geometry/box";
import Graph from "../graph/graph";
import LayoutComponent from "./layoutComponent";
import LayoutEdge from "./layoutEdge";
import LayoutNode from "./layoutNode";

export default class LayoutGraph extends Graph<LayoutNode, LayoutEdge> {
    public readonly mayHaveCycles: boolean;

    public entryNode: LayoutNode = null;
    public exitNode: LayoutNode = null;

    public minRank = 0;
    public maxRank = 0;

    private _ranks = null;

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
            minX = Math.min(minX, box.x);
            maxX = Math.max(maxX, box.x + box.width);
            minY = Math.min(minY, box.y);
            maxY = Math.max(maxY, box.y + box.height);
        });
        return new Box(minX, minY, maxX - minX, maxY - minY);
    }

    public ranks() {
        if (this._ranks === null) {
            const numRanks = this.maxRank - this.minRank + 1;
            this._ranks = new Array(numRanks);
            for (let r = 0; r < numRanks; ++r) {
                this._ranks[r] = [];
            }
            _.forEach(this.components(), (component: LayoutComponent) => {
                const componentOffset = component.minRank() - this.minRank;
                _.forEach(component.ranks(), (rank: Array<LayoutNode>, cr: number) => {
                    const rankOffset = componentOffset + cr
                    _.forEach(rank, (node: LayoutNode) => {
                        this._ranks[rankOffset].push(node);
                    });
                });
            });
        }
        return this._ranks;
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

    public updateRank(newRank: number) {
        const offset = newRank - this.minRank;
        this.minRank += offset;
        this.maxRank += offset;
        _.forEach(this.nodes(), node => {
            node.updateRank(node.rank + offset);
        });
    }

    protected _createComponent(): LayoutComponent {
        return new LayoutComponent(this);
    }
}
