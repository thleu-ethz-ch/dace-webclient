import * as _ from "lodash";
import SdfgGraph from "../graph/sdfgGraph";
import SdfgState from "../graph/sdfgState";
import MapEntry from "../graph/mapEntry";
import MapExit from "../graph/mapExit";
import AccessNode from "../graph/accessNode";
import Tasklet from "../graph/tasklet";
import SdfgEdge from "../graph/sdfgEdge";
import NestedSdfg from "../graph/nestedSdfg";
import MapNode from "../graph/mapNode";
import LibraryNode from "../graph/libraryNode";
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
            graph.addEdge(new SdfgEdge(graph, jsonEdge.src, jsonEdge.dst, jsonEdge));
        });
        this.contractMaps(graph);
        //console.log(graph);
        return graph;
    };
    Parser.addNode = function (graph, jsonNode) {
        var node = new (this.classForType(jsonNode.type))(parseInt(jsonNode.id), graph, jsonNode.label);
        // set child graph
        if (jsonNode.type === "NestedSDFG") {
            node.setChildGraph(this.parse(jsonNode.attributes.sdfg));
        }
        if (jsonNode.type === "SDFGState") {
            node.setChildGraph(this.parse(jsonNode));
        }
        // set connectors
        var inConnectors = jsonNode.attributes.in_connectors || [];
        var outConnectors = jsonNode.attributes.out_connectors || [];
        node.setConnectors(inConnectors, outConnectors);
        // set scope
        var scope = jsonNode.scope_entry ? parseInt(jsonNode.scope_entry) : null;
        if (node instanceof MapEntry) {
            scope = parseInt(jsonNode.id);
        }
        node.scopeEntry = scope;
        graph.addNode(node, jsonNode.id);
    };
    Parser.classForType = function (type) {
        var types = {
            "AccessNode": AccessNode,
            "LibraryNode": LibraryNode,
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
    Parser.contractMaps = function (graph) {
        // find child nodes and remove from current graph
        var nodesByEntryId = new Map();
        var entryIdByNode = new Map();
        var exitByEntryId = new Map();
        _.forEach(graph.nodes(), function (node) {
            if (node.scopeEntry === null) {
                return;
            }
            if (!nodesByEntryId.has(node.scopeEntry)) {
                nodesByEntryId.set(node.scopeEntry, []);
            }
            nodesByEntryId.get(node.scopeEntry).push(node);
            if (node instanceof MapExit) {
                exitByEntryId.set(node.scopeEntry, node.id);
            }
            entryIdByNode.set(node.id, node.scopeEntry);
        });
        // create map nodes and move connectors to them
        var mapByEntryId = new Map();
        nodesByEntryId.forEach(function (nodes, entryId) {
            var map = new MapNode(graph.nodes().length, graph.node(entryId).graph, nodes);
            map.inConnectors = graph.node(entryId).inConnectors;
            map.node(entryId).inConnectors = [];
            map.outConnectors = graph.node(exitByEntryId.get(entryId)).outConnectors;
            map.node(exitByEntryId.get(entryId)).outConnectors = [];
            mapByEntryId.set(entryId, graph.addNode(map));
        });
        // remove nodes from current graph
        _.forEach(graph.nodes(), function (node) {
            if (node.scopeEntry !== null) {
                graph.removeNode(node.id);
            }
        });
        // find child edges and remove from current graph
        var edgesByEntryId = new Map();
        _.forEach(graph.edges(), function (edge) {
            var srcAffected = entryIdByNode.has(edge.src);
            var dstAffected = entryIdByNode.has(edge.dst);
            if (srcAffected) {
                if (dstAffected) {
                    var map = graph.node(mapByEntryId.get(entryIdByNode.get(edge.src)));
                    graph.removeEdge(edge.id);
                    var newEdge = _.clone(edge);
                    map.childGraph().addEdge(edge);
                }
                else {
                    edge.src = mapByEntryId.get(entryIdByNode.get(edge.src));
                }
            }
            else if (dstAffected) {
                edge.dst = mapByEntryId.get(entryIdByNode.get(edge.dst));
            }
        });
    };
    return Parser;
}());
export default Parser;
//# sourceMappingURL=parser.js.map