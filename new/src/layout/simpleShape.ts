import LayoutElement from "./layoutElement";
import BoundingBox from "./boundingBox";

export default abstract class SimpleShape extends LayoutElement {
    protected _x: number = 0;
    protected _y: number = 0;
    protected _width: number = 0;
    protected _height: number = 0;

    constructor(x: number, y: number, width: number, height: number) {
        super();
        this._x = x;
        this._y = y;
        this._width = width;
        this._height = height;
    }

    offset(x: number, y: number): void {
        this._x += x;
        this._y += y;
    }

    boundingBox(): BoundingBox {
        return {
            x: this._x,
            y: this._y,
            width: this._width,
            height: this._height
        }
    }
}