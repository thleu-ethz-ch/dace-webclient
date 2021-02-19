import Group from "../layout/group";
import LayoutUtil from "../layouter/layoutUtil";
import * as _ from "lodash";
import Edge from "../layout/edge";
import Segment from "../layout/segment";

export default class LayoutAnalysis
{
    private _layout: Group = null;
    private _edges: Array<Edge> = null;
    private _segments: Array<Segment> = null;

    constructor(layout: Group) {
        this._layout = LayoutUtil.flattenLayout(layout);
    }

    /**
     * Counts pairs of intersecting edges.
     */
    edgeCrossings() {
        let counter = 0;
        for (let i = 0; i < this.edges.length; ++i) {
            for (let j = i + 1; j < this.edges.length; ++j) {
                if (this.edges[i].intersects(this.edges[j])) {
                    counter++;
                }
            }
        }
        return counter;
    }

    /**
     * Counts pairs of intersecting segments.
     */
    segmentCrossings() {
        let counter = 0;
        for (let i = 0; i < this.segments.length; ++i) {
            for (let j = i + 1; j < this.segments.length; ++j) {
                if (this.segments[i].intersects(this.segments[j])) {
                    counter++;
                }
            }
        }
        return counter;
    }

    crossingsMetric() {
        const cAll = this.segments.length * (this.segments.length - 1) / 2;
        let cImpossible = 0;
        const startPointsByGraph = new Map();
        for (let i = 0; i < this.edges.length; ++i) {
            const pointsA = this.edges[i].globalPoints();
            // segments of the same edge can not overlap
            cImpossible += this.edges[i].segments().length * (this.edges[i].segments().length - 1) / 2;
            for (let j = i + 1; j < this.edges.length; ++j) {
                if (this.edges[i].reference.graph !== this.edges[j].reference.graph) {
                    // edges of different graphs can not overlap
                    cImpossible += this.edges[i].segments().length * this.edges[j].segments().length;
                    continue;
                }
                const pointsB = this.edges[j].globalPoints();
                const sameStart = _.isEqual(pointsA[0], pointsB[0]);
                const sameEnd = _.isEqual(_.last(pointsA), _.last(pointsB));
                if (sameStart || sameEnd) {
                    cImpossible++;
                }
            }
        }
        const cMx = cAll - cImpossible;
        if (cMx === 0) {
            return 1;
        }
        const c = this.segmentCrossings();
        console.log(c + ' / ' + cMx);
        return 1 - (c / cMx);
    }

    bendsMetric() {
        const bAvg = (this.segments.length - this.edges.length) / this.segments.length;
        return 1 - bAvg;
    }

    get edges() {
        if (this._edges === null) {
            this._edges = [];
            _.forEach(this._layout.elements, (element) => {
                if (element instanceof Edge) {
                    this._edges.push(element);
                }
            });
        }
        return this._edges;
    }

    get segments() {
        if (this._segments === null) {
            this._segments = [];
            _.forEach(this.edges, (edge) => {
                _.forEach(edge.globalSegments(), (segment) => {
                    this._segments.push(segment);
                });
            });
        }
        return this._segments;
    }
}