import * as _ from "lodash";
var SdfgGraph = /** @class */ (function () {
    function SdfgGraph() {
        this._nodes = [];
        this._edges = [];
        this._outEdges = [];
        this._inEdges = [];
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
        node.id = id;
        node.graph = this;
        this._nodes[id] = node;
        this._inEdges[id] = [];
        this._outEdges[id] = [];
        return id;
    };
    SdfgGraph.prototype.addEdge = function (edge, id) {
        if (id === void 0) { id = null; }
        if (id === null) {
            id = this._edges.length;
        }
        edge.id = id;
        edge.graph = this;
        this._edges[id] = edge;
        this._inEdges[edge.dst].push(id);
        this._outEdges[edge.src].push(id);
        return id;
    };
    SdfgGraph.prototype.node = function (id) {
        return this._nodes[id];
    };
    SdfgGraph.prototype.edge = function (id) {
        return this._edges[id];
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
    SdfgGraph.prototype.inEdges = function (id) {
        return this._inEdges[id];
    };
    SdfgGraph.prototype.outEdges = function (id) {
        return this._outEdges[id];
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
            _.forEach(edge.shapes(), function (shape) {
                shapes.push(shape);
            });
        });
        return shapes;
    };
    return SdfgGraph;
}());
export default SdfgGraph;
//# sourceMappingURL=sdfgGraph.js.map