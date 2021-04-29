import LayoutConnector from "./layoutConnector";
import Vector from "../geometry/vector";

export default class LayoutBundle
{
    public connectors: Array<string> = [];
    public x;
    public y;

    addConnector(name: string) {
        this.connectors.push(name);
    }

    position(): Vector {
        return new Vector(this.x, this.y);
    }
}