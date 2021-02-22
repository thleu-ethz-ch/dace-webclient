import * as _ from "lodash";
var SdfgGraph = /** @class */ (function () {
    function SdfgGraph() {
        this._nodes = [];
        this._edges = [];
    }
    SdfgGraph.prototype.offsetChildren = function (x, y) {
        _.forEach(this.nodes(), function (node) {
            node.offset(x, y);
        });
        _.forEach(this.edges(), function (edge) {
            edge.offset(x, y);
        });
    };
    SdfgGraph.prototype.addNode = function (node, id) {
        if (id === void 0) { id = null; }
        if (id === null) {
            id = this._nodes.length;
        }
        this._nodes[id] = node;
        return id;
    };
    SdfgGraph.prototype.addEdge = function (edge) {
        var id = this._edges.length;
        edge.id = id;
        edge.graph = this;
        this._edges.push(edge);
        return id;
    };
    SdfgGraph.prototype.node = function (id) {
        return this._nodes[id];
    };
    SdfgGraph.prototype.removeNode = function (id) {
        delete this._nodes[id];
    };
    SdfgGraph.prototype.removeEdge = function (id) {
        delete this._edges[id];
    };
    SdfgGraph.prototype.edges = function () {
        return _.compact(this._edges);
    };
    SdfgGraph.prototype.nodes = function () {
        return _.compact(this._nodes);
    };
    SdfgGraph.prototype.boundingBox = function () {
        var minX = Number.POSITIVE_INFINITY;
        var maxX = Number.NEGATIVE_INFINITY;
        var minY = Number.POSITIVE_INFINITY;
        var maxY = Number.NEGATIVE_INFINITY;
        _.forEach(this.nodes(), function (node) {
            var box = node.boundingBox();
            minX = Math.min(minX, box.x);
            maxX = Math.max(maxX, box.x + box.width);
            minY = Math.min(minY, box.y);
            maxY = Math.max(maxY, box.y + box.height);
        });
        _.forEach(this.edges(), function (edge) {
            var box = edge.boundingBox();
            minX = Math.min(minX, box.x);
            maxX = Math.max(maxX, box.x + box.width);
            minY = Math.min(minY, box.y);
            maxY = Math.max(maxY, box.y + box.height);
        });
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    };
    SdfgGraph.prototype.shapes = function () {
        var shapes = [];
        _.forEach(this.nodes(), function (node) {
            _.forEach(node.shapes(), function (shape) {
                shapes.push(shape);
            });
        });
        _.forEach(this.edges(), function (edge) {
            shapes.push(edge.shape());
        });
        return shapes;
    };
    return SdfgGraph;
}());
export default SdfgGraph;
//# sourceMappingURL=sdfgGraph.js.map