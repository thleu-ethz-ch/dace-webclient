import BoundingBox from "./boundingBox";
import Text from "./text";
import Size from "./size";

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

    static textSize(text: string, fontSize: number = 12, paddingX: number = 0, paddingY: number = 0): Size {
        const box = (new Text(0, 0, text, fontSize)).boundingBox();
        return {
            width: box.width + 2 * paddingX,
            height: box.height + 2 * paddingY,
        }
    }
}