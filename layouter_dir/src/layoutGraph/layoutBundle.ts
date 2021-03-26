import LayoutConnector from "./layoutConnector";

export default class LayoutBundle
{
    public connectors: Array<LayoutConnector> = [];
    public x;
    public y;

    addConnector(connector: LayoutConnector) {
        this.connectors.push(connector);
    }
}