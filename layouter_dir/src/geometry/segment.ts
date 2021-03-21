import Vector from "./vector";
import Box from "./box";
import * as _ from "lodash";

export default class Segment {
    readonly start: Vector;
    readonly end: Vector;

    constructor(start: Vector, end: Vector) {
        this.start = start;
        this.end = end;
    }

    intersects(other: Segment): boolean {
        if (!this.boundingBox().intersects(other.boundingBox())) {
            return false;
        }
        if (_.isEqual(this.start, other.start) || _.isEqual(this.end, other.end)) {
            return false;
        }
        const deltaX = this.end.x - this.start.x;
        const deltaY = this.end.y - this.start.y;
        const offset = deltaX * this.start.y - deltaY * this.start.x;
        const startSide = deltaX * other.start.y > deltaY * other.start.x + offset;
        const endSide = deltaX * other.end.y > deltaY * other.end.x + offset;
        return startSide !== endSide;
    }

    intersectsBox(box: Box): boolean {
        if (!this.boundingBox().intersects(box)) {
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

    boundingBox(): Box {
        const minX = Math.min(this.start.x, this.end.x);
        const maxX = Math.max(this.start.x, this.end.x);
        const minY = Math.min(this.start.y, this.end.y);
        const maxY = Math.max(this.start.y, this.end.y);
        return new Box(minX, minY,  maxX - minX, maxY - minY);
    }

    vector(): Vector {
        return new Vector(
            this.end.x - this.start.x,
            this.end.y - this.start.y,
        );
    }

    length(): number {
        return this.vector().length();
    }
}