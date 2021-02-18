import BoundingBox from "../layout/boundingBox";
import Size from "../layout/size";
import Position from "../layout/position";

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

    static addPadding(box: BoundingBox, size: Size): Position {
        const padding = this.calculatePadding(box, size);
        return {
            x: box.x + padding.x,
            y: box.y + padding.y,
        }
    }

    static calculatePadding(box: BoundingBox, size: Size): Position {
        return {
            x: (size.width - box.width) / 2,
            y: (size.height - box.height) / 2,
        };
    }

    static calculatePaddingX(box: BoundingBox, size: Size): number {
        return (size.width - box.width) / 2;
    }

    static subtract(positionA: Position, positionB: Position): Position {
        return {
            x: positionA.x - positionB.x,
            y: positionA.y - positionB.y,
        }
    }

    static add(positionA: Position, positionB: Position) {
        return {
            x: positionA.x + positionB.x,
            y: positionB.x + positionB.y,
        };
    }
}