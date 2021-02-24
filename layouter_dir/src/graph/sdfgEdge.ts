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

    public x;
    public y;
    public width;
    public height;

    public points: Array<Point> = [];

    constructor(graph, src, dst, metadata) {
        this.graph = graph;
        this.src = parseInt(src);
        this.dst = parseInt(dst);
        this.srcConnector = metadata.src_connector || null;
        this.dstConnector = metadata.dst_connector || null;
        this.metadata = metadata;
    }

    boundingBox() {
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this.points, (point: Point) => {
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

    updateBoundingBox(): void
    {
        const box = this.boundingBox();
        this.x = box.x;
        this.y = box.y;
        this.width = box.width;
        this.height = box.height;
    }

    offset(x: number, y: number): void
    {
        _.forEach(this.points, (point) => {
            point.x += x;
            point.y += y;
        });
        this.updateBoundingBox();
    }

    shape(): Edge {
        // match edges to connectors
        if (this.srcConnector !== null) {
            const connector = this.graph.node(this.src).retrieveConnector("OUT", this.srcConnector);
            const position = connector.shape.position();
            position.x += Connector.DIAMETER / 2;
            position.y += Connector.DIAMETER;
            this.points[0] = position;
        }
        if (this.dstConnector !== null) {
            const connector = this.graph.node(this.dst).retrieveConnector("IN", this.dstConnector);
            const position = connector.shape.position();
            position.x += Connector.DIAMETER / 2;
            this.points[this.points.length - 1] = position;
        }

        return new Edge(this, _.clone(this.points));
    }
};
