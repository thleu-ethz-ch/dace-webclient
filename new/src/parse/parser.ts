import * as _ from "lodash";
import SdfgGraph from "../graph/sdfgGraph"
import SdfgState from "../graph/sdfgState";
import MapEntry from "../graph/mapEntry";
import MapExit from "../graph/mapExit";
import AccessNode from "../graph/accessNode";
import Tasklet from "../graph/tasklet";
import SdfgEdge from "../graph/sdfgEdge";
import NestedSdfg from "../graph/nestedSdfg";

export default class Parser
{
    static parse(json): SdfgGraph {
        const graph = new SdfgGraph();
        _.forEach(json.nodes, (jsonNode) => {
            this.addNode(graph, jsonNode);
        });
        _.forEach(json.edges, (jsonEdge) => {
            graph.addEdge(new SdfgEdge(jsonEdge.src, jsonEdge.dst, jsonEdge));
        });
        return graph;
    }

    static addNode(graph: SdfgGraph, jsonNode) {
        const node = new (this.classForType(jsonNode.type))(jsonNode);
        graph.addNode(jsonNode.id, node);
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
}
