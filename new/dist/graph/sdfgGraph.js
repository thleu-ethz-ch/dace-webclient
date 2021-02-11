var SdfgGraph = /** @class */ (function () {
    function SdfgGraph() {
        this.nodes = [];
        this.edges = [];
    }
    SdfgGraph.prototype.addNode = function (id, node) {
        this.nodes[id] = node;
    };
    SdfgGraph.prototype.addEdge = function (edge) {
        this.edges.push(edge);
    };
    return SdfgGraph;
}());
export default SdfgGraph;
//# sourceMappingURL=sdfgGraph.js.map