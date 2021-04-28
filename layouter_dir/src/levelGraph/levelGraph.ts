import Graph from "../graph/graph";
import LevelNode from "./levelNode";
import Edge from "../graph/edge";
import LayoutNode from "../layoutGraph/layoutNode";
import * as _ from "lodash";
import LayoutEdge from "../layoutGraph/layoutEdge";

export default class LevelGraph extends Graph<LevelNode, Edge<any, any>>
{
    private _ranks: Array<Array<LevelNode>> = null;
    private _minRank: number = Number.POSITIVE_INFINITY;
    private _maxRank: number = Number.NEGATIVE_INFINITY;
    private _firstNodeMap: Array<number> = [];
    private _lastNodeMap: Array<number> = [];

    constructor() {
        super();
    }

    public addLayoutNode(layoutNode: LayoutNode): LevelNode {
        let node = new LevelNode(layoutNode, layoutNode.rank, true);
        let src = this.addNode(node);
        this._firstNodeMap[layoutNode.id] = node.id;
        for (let r = layoutNode.rank + 1; r < layoutNode.rank + layoutNode.rankSpan; ++r) {
            this._maxRank = Math.max(this._maxRank, r);
            node = new LevelNode(layoutNode, r);
            let dst = this.addNode(node);
            this.addEdge(new Edge(src, dst, Number.POSITIVE_INFINITY));
            src = dst;
        }
        this._lastNodeMap[layoutNode.id] = node.id;
        return node;
    }

    public firstNode(layoutNodeId: number): LevelNode {
        return this.node(this._firstNodeMap[layoutNodeId]);
    }

    public addLayoutEdge(layoutEdge: LayoutEdge) {
        const src = this._lastNodeMap[layoutEdge.src];
        const dst = this._firstNodeMap[layoutEdge.dst];
        let existingEdge = this.edgeBetween(src, dst);
        if (existingEdge === undefined) {
            this.addEdge(new Edge(src, dst, layoutEdge.weight));
        } else {
            existingEdge.weight += layoutEdge.weight;
        }
    }

    public ranks(rankSpanning: boolean = true): Array<Array<LevelNode>> {
        if (this._ranks === null) {
            this._minRank = Number.POSITIVE_INFINITY;
            this._maxRank = Number.NEGATIVE_INFINITY;
            _.forEach(this.nodes(), (node: LevelNode) => {
                this._minRank = Math.min(this._minRank, node.rank);
                this._maxRank = Math.max(this._maxRank, node.rank);
            });
            const minRank = this._minRank;
            const maxRank = this._maxRank;
            const numRanks = maxRank - minRank + 1;
            this._ranks = new Array(numRanks);
            const unsortedRanks = new Array(numRanks);
            for (let r = 0; r < numRanks; ++r) {
                unsortedRanks[r] = [];
            }
            _.forEach(this.nodes(), (node: LevelNode) => {
                unsortedRanks[node.rank - minRank].push(node);
            });
            _.forEach(unsortedRanks, (rank, r) => {
                this._ranks[r] = _.sortBy(rank, (node: LevelNode) => {
                    return node.position;
                });
            });
        }
        return this._ranks;
    }

    public invalidateRanks(): void {
        this._ranks = null;
    }

    public maxX(): number {
        let maxX = Number.NEGATIVE_INFINITY;
        _.forEach(this.nodes(), (node: LevelNode) => {
            maxX = Math.max(maxX, node.x);
        });
        return maxX;
    }

}