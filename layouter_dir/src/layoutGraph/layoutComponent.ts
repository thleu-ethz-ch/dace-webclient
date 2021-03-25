import * as _ from "lodash";
import Component from "../graph/component";
import LayoutNode from "./layoutNode";
import LayoutEdge from "./layoutEdge";

export default class LayoutComponent extends Component<LayoutNode, LayoutEdge>
{
    private _ranks: Array<Array<LayoutNode>> = null;

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

    public ranks(rankSpanning: boolean = true): Array<Array<LayoutNode>> {
        if (this._ranks === null) {
            const minRank = this.minRank();
            const maxRank = this.maxRank();
            const numRanks = maxRank - minRank + 1;
            this._ranks = new Array(numRanks);
            const unsortedRanks = new Array(numRanks);
            for (let r = 0; r < numRanks; ++r) {
                unsortedRanks[r] = [];
            }
            _.forEach(this.nodes(), (node: LayoutNode) => {
                if (rankSpanning && node.childGraph !== null) {
                    for (let r = node.childGraph.minRank; r <= node.childGraph.maxRank; ++r) {
                        unsortedRanks[r - minRank].push(node);
                    }
                } else {
                    unsortedRanks[node.rank - minRank].push(node);
                }
            });
            _.forEach(unsortedRanks, (rank, r) => {
                this._ranks[r] = _.sortBy(rank, (node: LayoutNode) => {
                    if (node.indexes.length > 0) {
                        return node.indexes[r - (node.rank - minRank)];
                    } else {
                        return node.index;
                    }
                });
            });
        }
        return this._ranks;
    }
}
