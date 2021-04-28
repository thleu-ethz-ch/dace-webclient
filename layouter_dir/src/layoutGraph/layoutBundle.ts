import LayoutConnector from "./layoutConnector";

export default class LayoutBundle
{
    public connectors: Array<string> = [];
    public x;
    public y;

    addConnector(name: string) {
        this.connectors.push(name);
    }
}