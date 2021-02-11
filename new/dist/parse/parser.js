import * as _ from "lodash";
import SdfgGraph from "../graph/sdfgGraph";
import SdfgState from "../graph/sdfgState";
import MapEntry from "../graph/mapEntry";
import MapExit from "../graph/mapExit";
import AccessNode from "../graph/accessNode";
import Tasklet from "../graph/tasklet";
import SdfgEdge from "../graph/sdfgEdge";
import NestedSdfg from "../graph/nestedSdfg";
var Parser = /** @class */ (function () {
    function Parser() {
    }
    Parser.parse = function (json) {
        var _this = this;
        var graph = new SdfgGraph();
        _.forEach(json.nodes, function (jsonNode) {
            _this.addNode(graph, jsonNode);
        });
        _.forEach(json.edges, function (jsonEdge) {
            graph.addEdge(new SdfgEdge(jsonEdge.src, jsonEdge.dst, jsonEdge));
        });
        return graph;
    };
    Parser.addNode = function (graph, jsonNode) {
        var node = new (this.classForType(jsonNode.type))(jsonNode);
        graph.addNode(jsonNode.id, node);
    };
    Parser.classForType = function (type) {
        var types = {
            "AccessNode": AccessNode,
            "MapEntry": MapEntry,
            "MapExit": MapExit,
            "NestedSDFG": NestedSdfg,
            "SDFGState": SdfgState,
            "Tasklet": Tasklet,
        };
        if (!types.hasOwnProperty(type)) {
            throw new Error("Unknown node type: " + type);
        }
        return types[type];
    };
    return Parser;
}());
export default Parser;
//# sourceMappingURL=parser.js.map