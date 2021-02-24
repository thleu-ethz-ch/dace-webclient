import * as _ from "lodash";
import Connector from "./connector";
import Edge from "../layout/edge";
var SdfgEdge = /** @class */ (function () {
    function SdfgEdge(graph, src, dst, metadata) {
        this.id = null;
        this.graph = null;
        this.src = null;
        this.dst = null;
        this.srcConnector = null;
        this.dstConnector = null;
        this.metadata = {};
        this.points = [];
        this.graph = graph;
        this.src = parseInt(src);
        this.dst = parseInt(dst);
        this.srcConnector = metadata.src_connector || null;
        this.dstConnector = metadata.dst_connector || null;
        this.metadata = metadata;
    }
    SdfgEdge.prototype.boundingBox = function () {
        var minX = Number.POSITIVE_INFINITY;
        var maxX = Number.NEGATIVE_INFINITY;
        var minY = Number.POSITIVE_INFINITY;
        var maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this.points, function (point) {
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
    };
    SdfgEdge.prototype.updateBoundingBox = function () {
        var box = this.boundingBox();
        this.x = box.x;
        this.y = box.y;
        this.width = box.width;
        this.height = box.height;
    };
    SdfgEdge.prototype.offset = function (x, y) {
        _.forEach(this.points, function (point) {
            point.x += x;
            point.y += y;
        });
        this.updateBoundingBox();
    };
    SdfgEdge.prototype.shape = function () {
        // match edges to connectors
        if (this.srcConnector !== null) {
            var connector = this.graph.node(this.src).retrieveConnector("OUT", this.srcConnector);
            var position = connector.shape.position();
            position.x += Connector.DIAMETER / 2;
            position.y += Connector.DIAMETER;
            this.points[0] = position;
        }
        if (this.dstConnector !== null) {
            var connector = this.graph.node(this.dst).retrieveConnector("IN", this.dstConnector);
            var position = connector.shape.position();
            position.x += Connector.DIAMETER / 2;
            this.points[this.points.length - 1] = position;
        }
        return new Edge(this, _.clone(this.points));
    };
    return SdfgEdge;
}());
export default SdfgEdge;
;
//# sourceMappingURL=sdfgEdge.js.map