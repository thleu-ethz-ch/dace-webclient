import * as _ from "lodash";
import Parser from "./parser";
import RenderGraph from "../renderGraph/renderGraph";
import GenericNode from "../renderGraph/genericNode";
import RenderEdge from "../renderGraph/renderEdge";
import Memlet from "../renderGraph/memlet";

export default class Loader {
    static load(name): Promise<RenderGraph> {
        return fetch("./graphs/" + name + ".json")
            .then(response => response.json())
            .then(json => Parser.parse(json));
    }

    static loadDag(name): Promise<RenderGraph> {
        return fetch("./graphs/" + name + ".txt")
            .then(response => response.text())
            .then(text => {
                const graph = new RenderGraph();
                const lines = text.split('\r\n');
                const idMap = new Map();
                _.forEach(lines, (line: string) => {
                    const names = line.split(' ');
                    let srcId = idMap.get(names[0]);
                    if (srcId === undefined) {
                        srcId = graph.addNode(new GenericNode('GenericNode', names[0]));
                        idMap.set(names[0], srcId);
                    }
                    let dstId = idMap.get(names[1]);
                    if (dstId === undefined) {
                        dstId = graph.addNode(new GenericNode('GenericNode', names[1]));
                        idMap.set(names[1], dstId);
                    }
                    graph.addEdge(new Memlet(srcId, dstId));
                });
                return graph;
            });
    }
}
