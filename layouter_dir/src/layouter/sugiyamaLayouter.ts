import * as _ from "lodash";
import Layouter from "./layouter";
import LayoutGraph from "../layoutGraph/layoutGraph";
import LayoutNode from "../layoutGraph/layoutNode";
import LayoutEdge from "../layoutGraph/layoutEdge";
import OrderRank from "../order/orderRank";
import OrderGroup from "../order/orderGroup";
import LayoutConnector from "../layoutGraph/layoutConnector";
import OrderNode from "../order/orderNode";

export default class SugiyamaLayouter extends Layouter
{
    protected doLayout(graph: LayoutGraph): void {
        this._assignRanks(graph);
        this._addVirtualNodes(graph);
        this._orderRanks(graph);
        console.log(graph);
        const nodesPerRank = [];
        for (let r = 0; r <= graph.maxRank; ++r) {
            nodesPerRank[r] = [];
        }
        _.forEach(graph.allNodes(), (node: LayoutNode) => {
            nodesPerRank[node.rank].push(node);
        });
        for (let r = 0; r <= graph.maxRank; ++r) {
            console.log(r, _.map(nodesPerRank[r], "label"));
        }
    }

    private _assignRanks(graph: LayoutGraph, parentRank: number = 0): void {
        graph.minRank = parentRank;
        _.forEach(graph.components(), (component: LayoutGraph) => {
            component.minRank = parentRank;
            _.forEach(component.toposort(), (node: LayoutNode) => {
                node.rank = Math.max(node.rank, parentRank);
                let nextRank = node.rank + 1;
                if (node.childGraph !== null) {
                    this._assignRanks(node.childGraph, node.rank);
                    nextRank += node.childGraph.maxRank - node.childGraph.minRank;
                }
                _.forEach(component.outEdges(node.id), (edge: LayoutEdge) => {
                    const neighbor = component.node(edge.dst);
                    neighbor.rank = Math.max(neighbor.rank, nextRank);
                });
                component.maxRank = Math.max(component.maxRank, nextRank - 1);
            });
            graph.maxRank = Math.max(graph.maxRank, component.maxRank);
        });
        // inputs are now aligned at top

        if (this._options['alignInAndOut']) {
            // align outputs at bottom
            _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
                _.forEach(subgraph.components(), (component: LayoutGraph) => {
                    _.forEach(component.sinks(), (sink: LayoutNode) => {
                        let rank = component.maxRank;
                        if (sink.childGraph !== null) {
                            rank -= (sink.childGraph.maxRank - sink.childGraph.minRank);
                        }
                        sink.rank = rank;
                    })
                });
            });
        } else {
            // move inputs down as far as possible
            _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
                _.forEach(subgraph.components(), (component: LayoutGraph) => {
                    let minRank = _.fill(new Array(component.maxId() + 1), Number.POSITIVE_INFINITY);
                    _.forEachRight(component.sinks(), (node: LayoutNode) => {
                        minRank[node.id] = node.rank;
                    });
                    _.forEachRight(component.toposort(), (node: LayoutNode) => {
                        _.forEach(component.inEdges(node.id), (edge: LayoutEdge) => {
                            const neighbor = component.node(edge.src);
                            let nextRank = node.rank - 1;
                            if (neighbor.childGraph !== null) {
                                nextRank -= (neighbor.childGraph.maxRank - neighbor.childGraph.minRank);
                            }
                            minRank[neighbor.id] = Math.min(minRank[neighbor.id], nextRank);
                        });
                    });
                    _.forEach(component.nodes(), (node: LayoutNode) => {
                        node.rank = minRank[node.id];
                    });
                });
            });
        }
    }

    private _addVirtualNodes(graph: LayoutGraph) {
        _.forEach(graph.allEdges(), (edge: LayoutEdge) => {
            let srcNode = edge.graph.node(edge.src);
            let dstNode = edge.graph.node(edge.dst);
            let srcRank = srcNode.rank;
            if (srcNode.childGraph !== null) {
                srcRank += srcNode.childGraph.maxRank - srcNode.childGraph.minRank;
            }
            console.log("edge from rank " + srcRank + " to " + dstNode.rank);
            if (srcRank + 1 < dstNode.rank) {
                edge.graph.removeEdge(edge.id);
                let tmpSrcId = srcNode.id;
                let tmpDstId;
                for (let tmpDstRank = srcRank + 1; tmpDstRank < dstNode.rank; ++tmpDstRank) {
                    const newNode = new LayoutNode({width: 0, height: 0});
                    newNode.rank = tmpDstRank;
                    newNode.label = "virtual";
                    tmpDstId = edge.graph.addNode(newNode);
                    edge.graph.addEdge(new LayoutEdge(tmpSrcId, tmpDstId));
                    tmpSrcId = tmpDstId;
                }
                edge.graph.addEdge(new LayoutEdge(tmpSrcId, dstNode.id));
                edge.graph.invalidateComponents();
            }
        });
    }

    private _orderRanks(graph: LayoutGraph) {
        const orderRanks = [];
        for (let r = 0; r <= graph.maxRank; ++r) {
            orderRanks[r] = new OrderRank();
        }
        const inNodeMap = new Map();
        const outNodeMap = new Map();
        const connectorMap = new Map();
        _.forEach(graph.allNodes(), (node: LayoutNode) => {
            if (node.hasScopedConnectors) {
                const group = new OrderGroup({type: "ALL", node: node});
                orderRanks[node.rank].addGroup(group);
                inNodeMap.set(node, group.id);
                outNodeMap.set(node, group.id);
                _.forEach(node.inConnectors, (connector: LayoutConnector) => {
                    const connectorNode = new OrderNode(connector);
                    group.addNode(connectorNode);
                    connectorMap.set(connector, connectorNode.id);
                    if (connector.isScoped) {
                        connectorMap.set(connector.counterpart, connectorNode);
                    }
                });
                _.forEach(node.outConnectors, (connector: LayoutConnector) => {
                    if (!connector.isScoped) {
                        const connectorNode = new OrderNode(connector);
                        group.addNode(connectorNode);
                        connectorMap.set(connector, connectorNode.id);
                    }
                });
            } else {
                if (node.inConnectors.length > 0) {
                    const inGroup = new OrderGroup({type: "IN", node: node});
                    orderRanks[node.rank].addGroup(inGroup);
                    inNodeMap.set(node, inGroup.id);
                    _.forEach(node.inConnectors, (connector: LayoutConnector) => {
                        const connectorNode = new OrderNode(connector);
                        inGroup.addNode(connectorNode);
                        connectorMap.set(connector, connectorNode.id);
                    });
                }
                if (node.outConnectors.length > 0) {
                    const outGroup = new OrderGroup({type: "OUT", node: node});
                    orderRanks[node.rank].addGroup(outGroup);
                    outNodeMap.set(node, outGroup.id);
                    _.forEach(node.outConnectors, (connector: LayoutConnector) => {
                        const connectorNode = new OrderNode(connector);
                        outGroup.addNode(connectorNode);
                        connectorMap.set(connector, connectorNode.id);
                    });
                }
                if (node.inConnectors.length + node.outConnectors.length === 0) {
                    const group = new OrderGroup(null);
                    orderRanks[node.rank].addGroup(group);
                    inNodeMap.set(node, group.id);
                    outNodeMap.set(node, group.id);
                }
            }
        });
        _.forEach(graph.allEdges(), (edge: LayoutEdge) => {

        });
    }
}