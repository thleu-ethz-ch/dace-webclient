import Shape from "./shape";
import Box from "../geometry/box";
import SimpleShape from "./simpleShape";
import Color from "../renderer/color";

export default class Line extends SimpleShape {
    public lineWidth: number;
    public color: Color;
    public style: "solid" | "dashed";
    public x1: number;
    public y1: number;
    public x2: number;
    public y2: number;

    constructor(reference: object, x1: number, y1: number, x2: number, y2: number, lineWidth: number = 1, color: Color = Color.BLACK, style: "solid" | "dashed" = "solid") {
        super(reference, Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2) - Math.min(x1, x2), Math.max(y1, y2) - Math.min(y1, y2));
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.lineWidth = lineWidth;
        this.color = color;
        this.style = style;
    }
}
