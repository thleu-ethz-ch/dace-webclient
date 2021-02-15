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
import {MapNode} from "../graph/map";

export default class Parser {
    static parse(json): SdfgGraph {
        const graph = new SdfgGraph();
        _.forEach(json.nodes, (jsonNode) => {
            this.addNode(graph, jsonNode);
        });
        _.forEach(json.edges, (jsonEdge) => {
            graph.addEdge(new SdfgEdge(jsonEdge.src, jsonEdge.dst, jsonEdge));
        });
        this.contractMaps(graph);

        return graph;
    }

    static addNode(graph: SdfgGraph, jsonNode) {
        const node = new (this.classForType(jsonNode.type))(jsonNode);

        // set connectors
        const inConnectors = jsonNode.attributes.in_connectors || [];
        const outConnectors = jsonNode.attributes.out_connectors || [];
        node.setConnectors(inConnectors, outConnectors);

        // set scope
        let scope = jsonNode.scope_entry || null;
        if (node instanceof MapEntry) {
            scope = jsonNode.id;
        }
        node.setScopeEntry(scope);

        graph.addNode(node, jsonNode.id);
    }

    static classForType(type) {
        const types = {
            "AccessNode": AccessNode,
            "MapEntry": MapEntry,
            "MapExit": MapExit,
            "NestedSDFG": NestedSdfg,
            "SDFGState": SdfgState,
            "Tasklet": Tasklet,
        }
        if (!types.hasOwnProperty(type)) {
            throw new Error("Unknown node type: " + type);
        }
        return types[type];
    }

    static contractMaps(graph: SdfgGraph) {
        // find child nodes and remove from current graph
        const nodesByEntryId = new Map();
        const entryIdByNode = new Map();
        const exitByEntryId = new Map();
        _.forEach(graph.nodes, (node: SdfgNode) => {
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
            const map = new MapNode(graph.nodes.length, nodes);
            map.inConnectors = graph.node(entryId).inConnectors;
            map.node(entryId).inConnectors = [];
            map.outConnectors = graph.node(exitByEntryId.get(entryId)).outConnectors;
            map.node(exitByEntryId.get(entryId)).outConnectors = [];
            mapByEntryId.set(entryId, graph.addNode(map));
        });

        // remove nodes from current graph
        _.forEach(graph.nodes, (node: SdfgNode) => {
            if (node.scopeEntry !== null) {
                graph.removeNode(node.id);
            }
        });

        // find child edges and remove from current graph
        const edgesByEntryId = new Map();
        _.forEach(graph.edges, (edge: SdfgEdge) => {
            const srcAffected = entryIdByNode.has(edge.src);
            const dstAffected = entryIdByNode.has(edge.dst);
            if (srcAffected) {
                if (dstAffected) {
                    const map = <MapNode>graph.node(mapByEntryId.get(entryIdByNode.get(edge.src)));
                    graph.removeEdge(edge.id);
                    map.addEdge(edge);
                } else {
                    edge.src = mapByEntryId.get(entryIdByNode.get(edge.src));
                    //graph.removeEdge(edge.id);
                }
            } else if (dstAffected) {
                edge.dst = mapByEntryId.get(entryIdByNode.get(edge.dst));
                //graph.removeEdge(edge.id);
            }
        });
    }
}
