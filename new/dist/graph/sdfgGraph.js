import * as _ from "lodash";
var SdfgGraph = /** @class */ (function () {
    function SdfgGraph() {
        this._nodes = [];
        this._edges = [];
    }
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
    Object.defineProperty(SdfgGraph.prototype, "edges", {
        get: function () {
            return _.compact(this._edges);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SdfgGraph.prototype, "nodes", {
        get: function () {
            return _.compact(this._nodes);
        },
        enumerable: false,
        configurable: true
    });
    return SdfgGraph;
}());
export default SdfgGraph;
//# sourceMappingURL=sdfgGraph.js.map