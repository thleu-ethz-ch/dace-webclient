import * as PIXI from "pixi.js";
import SimpleShape from "./simpleShape";
import Color from "../renderer/color";

export default abstract class AbstractPolygon extends SimpleShape {
    public backgroundColor: Color;
    public borderColor: Color;

    constructor(reference: object, x: number, y: number, width: number, height: number, backgroundColor: Color = Color.WHITE, borderColor: Color = Color.BLACK) {
        super(reference, x, y, width, height);
        this.backgroundColor = backgroundColor;
        this.borderColor = borderColor;
    }

    abstract getPath(): Array<number>;
}
