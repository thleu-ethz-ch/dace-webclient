import SimpleShape from "./simpleShape";
import * as PIXI from "pixi.js";

export default abstract class Polygon extends SimpleShape {
    private _backgroundColor: number;
    private _borderColor: number;

    constructor(x: number, y: number, width: number, height: number, backgroundColor: number = 0xFFFFFF, borderColor: number = 0x000000) {
        super(x, y, width, height);
        this._backgroundColor = backgroundColor;
        this._borderColor = borderColor;
    }

    abstract getPath(): Array<number>;

    render(container: PIXI.Container): void {
        const polygon = new PIXI.Graphics();
        polygon.lineStyle(1, this._borderColor, 1);
        polygon.beginFill(this._backgroundColor);
        polygon.drawPolygon(this.getPath());
        polygon.endFill();
        container.addChild(polygon);
    }
}
