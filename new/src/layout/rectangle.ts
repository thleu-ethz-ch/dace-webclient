import {Container, Graphics} from "pixi.js";
import BoundingBox from "./boundingBox";
import SimpleShape from "./simpleShape";

export default class Rectangle extends SimpleShape {
    private _backgroundColor: number;
    private _borderColor: number;

    constructor(x: number, y: number, width: number, height: number, backgroundColor = 0xFFFFFF, borderColor = 0x000000) {
        super(x, y, width, height);
        this._backgroundColor = backgroundColor;
        this._borderColor = borderColor;
    }

    render(container: Container) {
        const rectangle = new Graphics();
        rectangle.lineStyle(1, this._borderColor, 1);
        rectangle.beginFill(this._backgroundColor);
        rectangle.drawRect(0, 0, this._width, this._height);
        rectangle.endFill();
        rectangle.x = this._x;
        rectangle.y = this._y;
        container.addChild(rectangle);
    }
}