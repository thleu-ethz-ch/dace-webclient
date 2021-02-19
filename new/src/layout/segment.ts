import Point from "./point";
import LayoutUtil from "../layouter/layoutUtil";
import BoundingBox from "./boundingBox";
import * as _ from "lodash";

export default class Segment {
    start: Point;
    end: Point;

    constructor(start: Point, end: Point) {
        this.start = start;
        this.end = end;
    }

    intersects(other: Segment): boolean {
        if (!LayoutUtil.boxesIntersect(this.boundingBox(), other.boundingBox())) {
            return false;
        }
        /*if (_.isEqual(this.start, other.start) || _.isEqual(this.end, other.end)) {
            return false;
        }*/
        const deltaX = this.end.x - this.start.x;
        const deltaY = this.end.y - this.start.y;
        const offset = deltaX * this.start.y - deltaY * this.start.x;
        const startSide = deltaX * other.start.y > deltaY * other.start.x + offset;
        const endSide = deltaX * other.end.y > deltaY * other.end.x + offset;
        return startSide !== endSide;
    }

    intersectsBox(box: BoundingBox): boolean {
        if (!LayoutUtil.boxesIntersect(this.boundingBox(), box)) {
            return false;
        }
        const deltaX = this.end.x - this.start.x;
        const deltaY = this.end.y - this.start.y;
        const offset = deltaX * this.start.y - deltaY * this.start.x;
        const topLeftSide = deltaX * box.y > deltaY * box.x + offset;
        const topRightSide = deltaX * box.y > deltaY * (box.x + box.width) + offset;
        const bottomLeftSide = deltaX * (box.y + box.height) > deltaY * box.x + offset;
        const bottomRightSide = deltaX * (box.y + box.height) > deltaY * (box.x + box.width) + offset;
        const sameSide = (topLeftSide === topRightSide
                       && topRightSide === bottomRightSide
                       && bottomRightSide === bottomLeftSide);
        return !sameSide;
    }

    boundingBox(): BoundingBox {
        const minX = Math.min(this.start.x, this.end.x);
        const maxX = Math.max(this.start.x, this.end.x);
        const minY = Math.min(this.start.y, this.end.y);
        const maxY = Math.max(this.start.y, this.end.y);
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        }
    }
}