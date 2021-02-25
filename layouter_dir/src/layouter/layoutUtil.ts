import BoundingBox from "../layout/boundingBox";
import Size from "../layout/size";
import Point from "../layout/point";
import Shape from "../layout/shape";
import * as _ from "lodash";

export default class LayoutUtil {
    static centerToCorner(box: BoundingBox): BoundingBox {
        return {
            x: box.x - box.width / 2,
            y: box.y - box.height / 2,
            width: box.width,
            height: box.height,
        }
    }

    static cornerToCenter(box: BoundingBox): BoundingBox {
        return {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
            width: box.width,
            height: box.height,
        }
    }

    static addPadding(box: BoundingBox, size: Size): Point {
        const padding = this.calculatePadding(box, size);
        return {
            x: box.x + padding.x,
            y: box.y + padding.y,
        }
    }

    static calculatePadding(box: BoundingBox, size: Size): Point {
        return {
            x: (size.width - box.width) / 2,
            y: (size.height - box.height) / 2,
        };
    }

    static calculatePaddingX(box: BoundingBox, size: Size): number {
        return (size.width - box.width) / 2;
    }

    static add(pointA: Point, pointB: Point) {
        return {
            x: pointA.x + pointB.x,
            y: pointA.y + pointB.y,
        };
    }

    static subtract(pointA: Point, pointB: Point): Point {
        return {
            x: pointA.x - pointB.x,
            y: pointA.y - pointB.y,
        }
    }

    static vectorLength(vector: Point) {
        return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    }

    static scaleVector(scalar: number, vector: Point) {
        return {
            x: scalar * vector.x,
            y: scalar * vector.y,
        }
    }

    static normalizeVector(vector: Point) {
        const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
        return {
            x: vector.x / length,
            y: vector.y / length,
        };
    }

    static boxesIntersect(boxA: BoundingBox, boxB: BoundingBox): boolean {
        return (boxA.x < boxB.x + boxB.width)
            && (boxA.x + boxA.width > boxB.x)
            && (boxA.y < boxB.y + boxB.height)
            && (boxA.y + boxA.height > boxB.y);
    }

    static circleIntersectionOffset(point1: Point, point2: Point, radius: number): Point {
        const squareRadius = radius * radius;
        const deltaX = point1.x - point2.x;
        const deltaY = point1.y - point2.y;
        const slope = deltaY / deltaX;
        let xLength = 0;
        let yLength = radius;
        if (deltaX !== 0) {
            xLength = Math.sqrt(squareRadius / (1 + slope * slope));
            yLength = Math.sqrt(squareRadius - xLength * xLength);
        }
        const offsetX = (deltaX > 0 ? -1 : 1) * xLength;
        const offsetY = (deltaY > 0 ? -1 : 1) * yLength;
        return {
            x: offsetX,
            y: offsetY,
        }
    }
}