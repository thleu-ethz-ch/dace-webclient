import Shape from "./shape";
import BoundingBox from "./boundingBox";
import Edge from "./edge";

export default abstract class SimpleShape extends Shape {
    protected _width: number;
    protected _height: number;

    constructor(x: number, y: number, width: number, height: number) {
        super(x, y);
        this._width = width;
        this._height = height;
    }

    resize(newWidth: number = null, newHeight: number = null) {
        if (newWidth !== null) {
            this._width = newWidth;
        }
        if (newHeight !== null) {
            this._height = newHeight;
        }
    }

    intersects(otherShape: Shape): boolean {
        if (otherShape instanceof Edge) {
            return otherShape.intersects(this);
        }
        return super.intersects(otherShape);
    }

    boundingBox(): BoundingBox {
        return {
            x: this._x,
            y: this._y,
            width: this._width,
            height: this._height,
        };
    }
}