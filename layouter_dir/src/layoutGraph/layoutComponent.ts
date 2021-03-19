import * as _ from "lodash";
import Component from "../graph/component";
import LayoutNode from "./layoutNode";
import LayoutEdge from "./layoutEdge";

export default class LayoutComponent extends Component<LayoutNode, LayoutEdge>
{
    private _minRank: number = null;
    private _maxRank: number = null;
    private _minIndex: number = null;
    private _maxIndex: number = null;
    private _ranks: Array<Array<LayoutNode>> = null;

    public minRank(): number {
        //if (this._minRank === null) {
            this.updateMinMaxRank();
        //}
        return this._minRank;
    }

    public maxRank(): number {
        //if (this._maxRank === null) {
            this.updateMinMaxRank();
        //}
        return this._maxRank;
    }

    public setMinRank(minRank: number) {
        this._minRank = minRank;
    }

    public setMaxRank(maxRank: number) {
        this._maxRank = maxRank;
    }

    public minIndex(): number {
        //if (this._minIndex === null) {
            this._updateMinMaxIndex();
        //}
        return this._minIndex;
    }

    public maxIndex(): number {
        //if (this._minIndex === null) {
            this._updateMinMaxIndex();
        //}
        return this._maxIndex;
    }

    public ranks(): Array<Array<LayoutNode>> {
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
                if (node.childGraph !== null) {
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

    public updateMinMaxRank() {
        this._minRank = Number.POSITIVE_INFINITY;
        this._maxRank = Number.NEGATIVE_INFINITY;
        _.forEach(this.nodes(), node => {
            this._minRank = Math.min(this._minRank, node.rank);
            this._maxRank = Math.max(this._maxRank, node.rank);
            if (node.childGraph !== null) {
                this._maxRank = Math.max(this._maxRank, node.childGraph.maxRank);
            }
        });
    }

    private _updateMinMaxIndex() {
        this._minIndex = Number.POSITIVE_INFINITY;
        this._maxIndex = Number.NEGATIVE_INFINITY;
        _.forEach(this.nodes(), (node: LayoutNode) => {
            if (node.indexes.length > 0) {
                _.forEach(node.indexes, index => {
                    this._minIndex = Math.min(this._minIndex, index);
                    this._maxIndex = Math.max(this._maxIndex, index);
                });
            } else {
                this._minIndex = Math.min(this._minIndex, node.index);
                this._maxIndex = Math.max(this._maxIndex, node.index);
            }
        });
    }
}
