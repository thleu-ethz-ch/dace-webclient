import * as _ from "lodash";
import Component from "../graph/component";
import LayoutNode from "./layoutNode";
import LayoutEdge from "./layoutEdge";
import LevelGraph from "../levelGraph/levelGraph";
import LevelNode from "../levelGraph/levelNode";
import Box from "../geometry/box";

export default class LayoutComponent extends Component<LayoutNode, LayoutEdge>
{
    private _levelGraph: LevelGraph = null;

    public minRank(): number {
        let minRank = Number.POSITIVE_INFINITY;
        _.forEach(this.nodes(), node => {
            minRank = Math.min(minRank, node.rank);
        });
        return minRank;
    }

    public maxRank(): number {
        let maxRank = Number.NEGATIVE_INFINITY;
        _.forEach(this.nodes(), node => {
            maxRank = Math.max(maxRank, node.rank + node.rankSpan - 1);
        });
        return maxRank;
    }

    public levelGraph(): LevelGraph {
        if (this._levelGraph === null) {
            this._levelGraph = new LevelGraph();
            _.forEach(this.nodes(), (node: LayoutNode) => {
                this._levelGraph.addLayoutNode(node);
            });
            _.forEach(this.edges(), (edge: LayoutEdge) => {
                this._levelGraph.addLayoutEdge(edge);
            });
        }
        return this._levelGraph;
    }

    public invalidateLevelGraph(): void {
        this._levelGraph = null;
    }

    public boundingBox(): Box {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this.nodes(), (node: LayoutNode) => {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x + node.width);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y + node.height);
        });
        return new Box(minX, minY, maxX - minX, maxY - minY);
    }
}
