import * as _ from "lodash";
import Connector from "./connector";
import Edge from "../layout/edge";
import Text from "../layout/text";
import Rectangle from "../layout/rectangle";
import Color from "../layout/color";
var SdfgEdge = /** @class */ (function () {
    function SdfgEdge(graph, src, dst, srcConnector, dstConnector, attributes) {
        this.id = null;
        this.graph = null;
        this.src = null;
        this.dst = null;
        this.srcConnector = null;
        this.dstConnector = null;
        this.attributes = {};
        this.x = null;
        this.y = null;
        this.width = null;
        this.height = null;
        this.labelX = null;
        this.labelY = null;
        this.points = [];
        this.graph = graph;
        this.src = parseInt(src);
        this.dst = parseInt(dst);
        this.srcConnector = srcConnector || null;
        this.dstConnector = dstConnector || null;
        this.attributes = attributes;
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
        if (this.labelX) {
            this.labelX += x;
            this.labelY += y;
        }
    };
    SdfgEdge.prototype.shapes = function () {
        this.matchEdgesToConnectors();
        var shapes = [new Edge(this, _.clone(this.points))];
        if (this.labelX) {
            var labelSize = this.labelSize();
            shapes.push(new Rectangle(null, this.labelX - 3, this.labelY - 3, labelSize.width + 6, labelSize.height + 6, new Color(255, 255, 255, 0.8), Color.TRANSPARENT));
            shapes.push(new Text(this.labelX, this.labelY, this.label(), SdfgEdge.LABEL_FONT_SIZE, 0x666666));
        }
        return shapes;
    };
    SdfgEdge.prototype.matchEdgesToConnectors = function () {
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
    };
    SdfgEdge.prototype.labelSize = function () {
        var label = this.label();
        if (!label || label.length === 0) {
            return {
                width: 0,
                height: 0,
            };
        }
        var constructor = this.constructor;
        var box = (new Text(0, 0, label, constructor.LABEL_FONT_SIZE)).boundingBox();
        return {
            width: box.width,
            height: box.height,
        };
    };
    SdfgEdge.prototype.sdfgPropertyToString = function (property) {
        if (property === null) {
            return "";
        }
        if (typeof property === "boolean") {
            return property ? "True" : "False";
        }
        else if (property.type === "Indices" || property.type === "subsets.Indices") {
            var indices = property.indices;
            var preview = '[';
            for (var _i = 0, indices_1 = indices; _i < indices_1.length; _i++) {
                var index = indices_1[_i];
                preview += this.sdfgPropertyToString(index) + ', ';
            }
            return preview.slice(0, -2) + ']';
        }
        else if (property.type === "Range" || property.type === "subsets.Range") {
            var ranges = property.ranges;
            // Generate string from range
            var preview = '[';
            for (var _a = 0, ranges_1 = ranges; _a < ranges_1.length; _a++) {
                var range = ranges_1[_a];
                preview += this.sdfgRangeToString(range) + ', ';
            }
            return preview.slice(0, -2) + ']';
        }
        else if (property.language !== undefined) {
            // Code
            if (property.string_data !== '' && property.string_data !== undefined && property.string_data !== null) {
                return '<pre class="code"><code>' + property.string_data.trim() +
                    '</code></pre><div class="clearfix"></div>';
            }
            return '';
        }
        else if (property.approx !== undefined && property.main !== undefined) {
            // SymExpr
            return property.main;
        }
        else if (property.constructor == Object) {
            // General dictionary
            return '<pre class="code"><code>' + JSON.stringify(property, undefined, 4) +
                '</code></pre><div class="clearfix"></div>';
        }
        else if (property.constructor == Array) {
            // General array
            var result = '[ ';
            var first = true;
            for (var _b = 0, property_1 = property; _b < property_1.length; _b++) {
                var subprop = property_1[_b];
                if (!first)
                    result += ', ';
                result += this.sdfgPropertyToString(subprop);
                first = false;
            }
            return result + ' ]';
        }
        else {
            return property;
        }
    };
    SdfgEdge.prototype.sdfgRangeToString = function (range) {
        var preview = '';
        if (range.start == range.end && range.step == 1 && range.tile == 1) {
            preview += this.sdfgPropertyToString(range.start);
        }
        else {
            var endp1 = this.sdfgPropertyToString(range.end) + ' + 1';
            // Try to simplify using math.js
            preview += this.sdfgPropertyToString(range.start) + ':' + endp1;
            if (range.step != 1) {
                preview += ':' + this.sdfgPropertyToString(range.step);
                if (range.tile != 1)
                    preview += ':' + this.sdfgPropertyToString(range.tile);
            }
            else if (range.tile != 1) {
                preview += '::' + this.sdfgPropertyToString(range.tile);
            }
        }
        return preview;
    };
    SdfgEdge.LABEL_FONT_SIZE = 10;
    return SdfgEdge;
}());
export default SdfgEdge;
;
//# sourceMappingURL=sdfgEdge.js.map