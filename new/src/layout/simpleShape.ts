import Shape from "./shape";
import BoundingBox from "./boundingBox";
import Position from "./position";

export default abstract class SimpleShape extends Shape {
    protected _width: number;
    protected _height: number;

    constructor(x: number, y: number, width: number, height: number) {
        super(x, y);
        this._width = width;
        this._height = height;
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