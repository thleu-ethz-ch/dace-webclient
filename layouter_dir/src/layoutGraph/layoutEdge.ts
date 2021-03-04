import * as _ from "lodash";
import Box from "../geometry/box";
import Edge from "../graph/edge";
import LayoutGraph from "./layoutGraph";
import LayoutNode from "./layoutNode";
import Segment from "../geometry/segment";
import Size from "../geometry/size";
import Vector from "../geometry/vector";

export default class LayoutEdge extends Edge<LayoutGraph, LayoutNode> {
    public readonly srcConnector: string;
    public readonly dstConnector: string;
    public readonly labelSize: Size = null;

    public points: Array<Vector> = [];
    public labelX: number = null;
    public labelY: number = null;

    constructor(src: number, dst: number, srcConnector: string = null, dstConnector: string = null, labelSize: Size = null) {
        super(src, dst);
        this.srcConnector = srcConnector;
        this.dstConnector = dstConnector;
        this.labelSize = labelSize;
    }

    translate(x: number, y: number): void {
        _.forEach(this.points, (point) => {
            point.x += x;
            point.y += y;
        });
        if (this.labelX) {
            this.labelX += x;
            this.labelY += y;
        }
    }

    boundingBox(): Box {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this.points, (point: Vector) => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
        return new Box(minX, minY, maxX - minX, maxY - minY);
    }

    segments(): Array<Segment> {
        const segments = [];
        let start = _.clone(this.points[0]);
        let end = _.clone(this.points[1]);
        for (let i = 2; i < this.points.length; ++i) {
            const deltaXPrev = end.x - start.x;
            const deltaYPrev = end.y - start.y;
            const deltaXNext = this.points[i].x - end.x;
            const deltaYNext = this.points[i].y - end.y;
            if (deltaXPrev * deltaYNext === deltaXNext * deltaYPrev) {
                end = _.clone(this.points[i]);
            } else {
                segments.push(new Segment(start, end));
                start = _.clone(end);
                end = _.clone(this.points[i]);
            }
        }
        segments.push(new Segment(start, end));
        return segments;
    }


}