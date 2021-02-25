import * as _ from "lodash";
import SdfgGraph from "../graph/sdfgGraph"
import SdfgState from "../graph/sdfgState";
import MapEntry from "../graph/mapEntry";
import MapExit from "../graph/mapExit";
import AccessNode from "../graph/accessNode";
import Tasklet from "../graph/tasklet";
import SdfgEdge from "../graph/sdfgEdge";
import NestedSdfg from "../graph/nestedSdfg";
import SdfgNode from "../graph/sdfgNode";
import MapNode from "../graph/mapNode";
import LibraryNode from "../graph/libraryNode";
import Memlet from "../graph/memlet";
import InterstateEdge from "../graph/interstateEdge";
import LayoutUtil from "../layouter/layoutUtil";

export default class Parser {
    static parse(json): SdfgGraph {
        const graph = new SdfgGraph();
        _.forEach(json.nodes, (jsonNode) => {
            this.addNode(graph, jsonNode);
        });
        _.forEach(json.edges, (jsonEdge) => {
            const edge = new (this.classForType(jsonEdge.attributes.data.type))(graph, jsonEdge.src, jsonEdge.dst, jsonEdge.src_connector, jsonEdge.dst_connector, jsonEdge.attributes.data.attributes);
            graph.addEdge(edge);
        });
        //this.contractMaps(graph);
        return graph;
    }

    static addNode(graph: SdfgGraph, jsonNode) {
        const node = new (this.classForType(jsonNode.type))(parseInt(jsonNode.id), graph, jsonNode.label);

        // set child graph
        if (jsonNode.type === "NestedSDFG") {
            node.setChildGraph(this.parse(jsonNode.attributes.sdfg));
        }
        if (jsonNode.type === "SDFGState") {
            node.setChildGraph(this.parse(jsonNode));
        }

        // set connectors
        const inConnectors = jsonNode.attributes.in_connectors || [];
        const outConnectors = jsonNode.attributes.out_connectors || [];
        node.setConnectors(inConnectors, outConnectors);

        // set scope
        let scope = jsonNode.scope_entry ? parseInt(jsonNode.scope_entry) : null;
        if (node instanceof MapEntry) {
            scope = parseInt(jsonNode.id);
        }
        node.scopeEntry = scope;

        graph.addNode(node, jsonNode.id);
    }

    static classForType(type) {
        const types = {
            "AccessNode": AccessNode,
            "LibraryNode": LibraryNode,
            "MapEntry": MapEntry,
            "MapExit": MapExit,
            "NestedSDFG": NestedSdfg,
            "SDFGState": SdfgState,
            "Tasklet": Tasklet,
            "Memlet": Memlet,
            "InterstateEdge": InterstateEdge,
        }
        if (!types.hasOwnProperty(type)) {
            throw new Error("Unknown node or edge type: " + type);
        }
        return types[type];
    }

    static contractMaps(graph: SdfgGraph) {
        // find child nodes and remove from current graph
        const nodesByEntryId = new Map();
        const entryIdByNode = new Map();
        const exitByEntryId = new Map();
        _.forEach(graph.nodes(), (node: SdfgNode) => {
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
        const mapByEntryId = new Map();
        nodesByEntryId.forEach((nodes, entryId) => {
            const map = new MapNode(graph.nodes().length, graph.node(entryId).graph, nodes);
            map.inConnectors = graph.node(entryId).inConnectors;
            map.node(entryId).inConnectors = [];
            map.outConnectors = graph.node(exitByEntryId.get(entryId)).outConnectors;
            map.node(exitByEntryId.get(entryId)).outConnectors = [];
            mapByEntryId.set(entryId, graph.addNode(map));
        });

        // remove nodes from current graph
        _.forEach(graph.nodes(), (node: SdfgNode) => {
            if (node.scopeEntry !== null) {
                graph.removeNode(node.id);
            }
        });

        // find child edges and remove from current graph
        const edgesByEntryId = new Map();
        _.forEach(graph.edges(), (edge: SdfgEdge) => {
            const srcAffected = entryIdByNode.has(edge.src);
            const dstAffected = entryIdByNode.has(edge.dst);
            if (srcAffected) {
                if (dstAffected) {
                    const map = <MapNode>graph.node(mapByEntryId.get(entryIdByNode.get(edge.src)));
                    graph.removeEdge(edge.id);
                    const newEdge = _.clone(edge);
                    map.childGraph.addEdge(edge);
                } else {
                    edge.src = mapByEntryId.get(entryIdByNode.get(edge.src));
                }
            } else if (dstAffected) {
                edge.dst = mapByEntryId.get(entryIdByNode.get(edge.dst));
            }
        });
    }
}
