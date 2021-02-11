import {Container} from "pixi.js";
import BoundingBox from "./boundingBox";

export default abstract class LayoutElement
{
    abstract render(container: Container): void;

    abstract boundingBox(): BoundingBox;

    abstract offset(x, y): void;
}