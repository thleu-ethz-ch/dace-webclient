import Shape from "../layout/shape";
import SimpleShape from "../layout/simpleShape";

export default class Connector
{
    public static WIDTH = 10;
    public static MARGIN = 10;
    public static PADDING = 20;

    public id: string;
    public shape: SimpleShape = null;

    constructor(id: string) {
        this.id = id;
    }
}