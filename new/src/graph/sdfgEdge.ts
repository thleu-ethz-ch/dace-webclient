import * as _ from "lodash";
import Connector from "./connector";
import Edge from "../layout/edge";
import Point from "../layout/point";
import SdfgGraph from "./sdfgGraph";

export default class SdfgEdge {
    public id: number = null;
    public graph: SdfgGraph = null;
    public src: number = null;
    public dst: number = null;
    public srcConnector: string = null;
    public dstConnector: string = null;
    public metadata = {};

    private _points: Array<Point> = [];

    constructor(graph, src, dst, metadata) {
        this.graph = graph;
        this.src = parseInt(src);
        this.dst = parseInt(dst);
        this.srcConnector = metadata.src_connector || null;
        this.dstConnector = metadata.dst_connector || null;
        this.metadata = metadata;
    }

    setPoints(points: Array<Point>) {
        this._points = _.clone(points);
    }

    boundingBox() {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this._points, (point: Point) => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    offset(x: number, y: number): void
    {
        _.forEach(this._points, (point) => {
            point.x += x;
            point.y += y;
        });
    }

    shape(): Edge {
        // match edges to connectors
        /*if (this.srcConnector !== null) {
            if (this.graph.node(this.src) === undefined) {
                console.log(this.graph, this);
            }
            const connector = this.graph.node(this.src).retrieveConnector("OUT", this.srcConnector);
            const position = connector.shape.position();
            position.x += Connector.DIAMETER / 2;
            position.y += Connector.DIAMETER;
            this._points[0] = position;
        }
        if (this.dstConnector !== null) {
            const connector = this.graph.node(this.dst).retrieveConnector("IN", this.dstConnector);
            const position = connector.shape.position();
            position.x += Connector.DIAMETER / 2;
            this._points[this._points.length - 1] = position;
        }*/

        return new Edge(this, _.clone(this._points));
    }
};
