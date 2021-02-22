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

    static subtract(positionA: Point, positionB: Point): Point {
        return {
            x: positionA.x - positionB.x,
            y: positionA.y - positionB.y,
        }
    }

    static add(positionA: Point, positionB: Point) {
        return {
            x: positionA.x + positionB.x,
            y: positionA.y + positionB.y,
        };
    }

    static boxesIntersect(boxA: BoundingBox, boxB: BoundingBox): boolean {
        return (boxA.x < boxB.x + boxB.width)
            && (boxA.x + boxA.width > boxB.x)
            && (boxA.y < boxB.y + boxB.height)
            && (boxA.y + boxA.height > boxB.y);
    }
}