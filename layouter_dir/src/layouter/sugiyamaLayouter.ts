import * as _ from "lodash";
import Assert from "../util/assert";
import Box from "../geometry/box";
import Edge from "../graph/edge";
import Graph from "../graph/graph";
import Layouter from "./layouter";
import LayoutConnector from "../layoutGraph/layoutConnector";
import LayoutComponent from "../layoutGraph/layoutComponent";
import LayoutEdge from "../layoutGraph/layoutEdge";
import LayoutGraph from "../layoutGraph/layoutGraph";
import LayoutNode from "../layoutGraph/layoutNode";
import Node from "../graph/node";
import OrderGraph from "../order/orderGraph";
import OrderGroup from "../order/orderGroup";
import OrderNode from "../order/orderNode";
import OrderRank from "../order/orderRank";
import OrderEdge from "../order/orderEdge";
import Vector from "../geometry/vector";

export default class SugiyamaLayouter extends Layouter
{

    protected doLayout(graph: LayoutGraph): void {
        if (graph.nodes().length === 0) {
            return;
        }

        this._removeCycles(graph);
        Assert.assert(!graph.hasCycle(), "graph has cycle");

        this._assignRanks(graph);
        Assert.assertNone(graph.allNodes(), node => node.rank < 0, "invalid rank assignment");

        this._addVirtualNodes(graph);
        Assert.assertNone(graph.allEdges(), edge => {
            const srcNode = edge.graph.node(edge.src)
            return srcNode.rank + srcNode.rankSpan !== edge.graph.node(edge.dst).rank;
        }, "edge not between neighboring ranks");

        this._orderRanks(graph);
        Assert.assertNone(graph.allNodes(), node => typeof node.index !== "number" || isNaN(node.index), "invalid index");
        Assert.assertNone(graph.allNodes(), node => node.childGraph !== null && node.indexes.length < node.rankSpan, "wrong number of indexes");
        Assert.assertNone(graph.allNodes(), node => node.childGraph !== null && _.max(node.indexes) !== node.index, "index is not maximum of indexes");

        this._assignCoordinates(graph);
        Assert.assertNone(graph.allNodes(), node => typeof node.y !== "number" || isNaN(node.y), "invalid y assignment");
        Assert.assertNone(graph.allNodes(), node => typeof node.x !== "number" || isNaN(node.x), "invalid x assignment");

        this._restoreCycles(graph);
    }

    private _removeCycles(graph: LayoutGraph): void {
        _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
            if (subgraph.mayHaveCycles) {
                subgraph.removeCycles();
            }
        });
    }

    private _assignRanks(graph: LayoutGraph): void {
        graph.minRank = 0;
        graph.maxRank = 0;
        _.forEach(graph.components(), (component: LayoutComponent) => {
            // first determine the rank span of all nodes
            _.forEach(component.nodes(), (node: LayoutNode) => {
                if (node.childGraph !== null) {
                    this._assignRanks(node.childGraph);
                    node.rankSpan = node.childGraph.maxRank - node.childGraph.minRank + 1;
                }
            });

            // do toposort and allocate each node with one of its ancestor sources
            const rankPerNode: Array<Map<number, number>> = new Array(component.maxId() + 1);
            for (let n = 0; n < rankPerNode.length; ++n) {
                rankPerNode[n] = new Map();
            }
            const minSourcePerNode: Array<number> = _.fill(new Array(component.maxId() + 1), Number.POSITIVE_INFINITY);
            const sources = component.sources();
            const nodesBySource = new Array(sources.length);
            const clusterGraph = new Graph();
            _.forEach(sources, (source: LayoutNode, s: number) => {
                nodesBySource[s] = [];
                rankPerNode[source.id].set(s, 0);
                minSourcePerNode[source.id] = s;
                clusterGraph.addNode(new Node(), s);
            });
            _.forEach(component.toposort(), (node) => {
                const s = minSourcePerNode[node.id];
                // set rank according to minimum s
                rankPerNode[node.id].forEach((rankI, sI) => {
                    if (s === sI) {
                        nodesBySource[s].push(node);
                        node.rank = rankI;
                    }
                });
                // set offset to other sources
                rankPerNode[node.id].forEach((rankI, sI) => {
                    if (s !== sI) {
                        const weight = node.rank - rankI;
                        clusterGraph.addEdge(new Edge(s, sI, weight));
                    }
                });

                let nextRank = node.rank + node.rankSpan;
                _.forEach(graph.outEdges(node.id), (outEdge: LayoutEdge) => {
                    if (rankPerNode[outEdge.dst].has(s)) {
                        nextRank = Math.max(nextRank, rankPerNode[outEdge.dst].get(s));
                    } else {
                        minSourcePerNode[outEdge.dst] = Math.min(minSourcePerNode[outEdge.dst], s);
                    }
                    rankPerNode[outEdge.dst].set(s, nextRank);
                });
            });

            // do toposort on cluster graph to merge clusters
            const clusterSources = clusterGraph.sources();
            Assert.assert(clusterSources.length === 1, "more than one cluster sources");
            const minDifferenceBySource = _.fill(new Array(sources.length), Number.POSITIVE_INFINITY);
            minDifferenceBySource[clusterSources[0].id] = 0;
            _.forEach(clusterGraph.toposort(), (clusterNode: Node<any, any>) => {
                const diff = minDifferenceBySource[clusterNode.id];
                _.forEach(clusterGraph.outEdges(clusterNode.id), (outEdge: Edge<any, any>) => {
                    minDifferenceBySource[outEdge.dst] = Math.min(minDifferenceBySource[outEdge.dst], diff + outEdge.weight);
                });
            });

            for (let s = 0; s < sources.length; ++s) {
                _.forEach(nodesBySource[s], (node: LayoutNode) => {
                    node.rank += minDifferenceBySource[s];
                });
            }

            let minRank = Number.POSITIVE_INFINITY;
            let maxRank = Number.NEGATIVE_INFINITY;
            _.forEach(component.nodes(), (node: LayoutNode) => {
                Assert.assertNumber(node.rank, "rank is not a valid number");
                minRank = Math.min(minRank, node.rank);
                maxRank = Math.min(maxRank, node.rank + node.rankSpan - 1);
            });
            const difference = 0 - minRank;
            _.forEach(component.nodes(), (node) => {
                node.rank += difference;
            });

            if (this._options['alignInAndOut']) {
                _.forEach(sources, (source: LayoutNode) => {
                    if (source.isAccessNode) {
                        source.rank = component.minRank();
                    }
                });
                _.forEach(component.sinks(), (sink: LayoutNode) => {
                    if (sink.isAccessNode) {
                        sink.rank = component.maxRank();
                    }
                });
            }
            graph.maxRank = Math.max(graph.maxRank, component.maxRank());
        });

        // finally, transform relative ranks to absolute
        if (graph.parentNode === null) {
            const transformSubgraph = (subgraph: LayoutGraph, offset: number) => {
                subgraph.minRank += offset;
                subgraph.maxRank += offset;
                _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                    if (node.childGraph !== null) {
                        transformSubgraph(node.childGraph, offset + node.rank);
                    }
                    node.rank += offset;
                });
            };
            transformSubgraph(graph, 0);
        }
    }

    private _addVirtualNodes(graph: LayoutGraph) {
        // place intermediate nodes between long edges
        _.forEach(graph.allEdges(), (edge: LayoutEdge) => {
            let srcNode = edge.graph.node(edge.src);
            let dstNode = edge.graph.node(edge.dst);
            let srcRank = srcNode.rank;
            if (srcNode.childGraph !== null) {
                srcRank += srcNode.childGraph.maxRank - srcNode.childGraph.minRank;
            }
            if (srcRank + 1 < dstNode.rank) {
                let tmpSrcId = srcNode.id;
                let tmpDstId;
                const dstConnector = edge.dstConnector;
                for (let tmpDstRank = srcRank + 1; tmpDstRank < dstNode.rank; ++tmpDstRank) {
                    const newNode = new LayoutNode({width: 0, height: 0}, 0, true);
                    newNode.rank = tmpDstRank;
                    newNode.label = "virtual";
                    tmpDstId = edge.graph.addNode(newNode);
                    if (tmpDstRank === srcRank + 1) {
                        // original edge is redirected from source to first virtual node
                        edge.graph.removeEdge(edge.id);
                        edge.dst = tmpDstId;
                        edge.dstConnector = null;
                        edge.graph.addEdge(edge, edge.id);
                    } else {
                        edge.graph.addEdge(new LayoutEdge(tmpSrcId, tmpDstId));
                    }
                    tmpSrcId = tmpDstId;
                }
                // last virtual edge has the original dstConnector
                edge.graph.addEdge(new LayoutEdge(tmpSrcId, dstNode.id, null, dstConnector));
            }
        });

        // add a virtual node in every empty child graph
        _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
            if (subgraph.nodes().length === 0) {
                const newNode = new LayoutNode({width: 0, height: 0}, 0, true);
                newNode.rank = subgraph.minRank;
                newNode.label = "virtual";
                subgraph.addNode(newNode);
            }
        });
    }

    private _orderRanks(graph: LayoutGraph) {

        /**
         * STEP 1: ORDER NODES
         * This is done strictly hierarchically.
         * Child graphs are represented as a chain over multiple ranks in their parent.
         */

        const inNodeMap = new Map();
        const outNodeMap = new Map();
        _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
            _.forEach(subgraph.components(), (component: LayoutComponent) => {
                // init graph and ranks
                const orderGraph = new OrderGraph();
                const orderGroups = new Array(component.maxRank() + 1);
                for (let r = component.minRank(); r <= component.maxRank(); ++r) {
                    const orderRank = new OrderRank();
                    orderGraph.addRank(orderRank);
                    orderGroups[r] = new OrderGroup(null);
                    orderRank.addGroup(orderGroups[r]);
                }
                // add nodes
                _.forEach(component.nodes(), (node: LayoutNode) => {
                    let orderNode = new OrderNode(node, node.label);
                    orderGroups[node.rank].addNode(orderNode);
                    inNodeMap.set(node, orderNode.id);

                    if (node.rankSpan > 1) {
                        // add chain nodes and edges
                        let srcId = orderNode.id;
                        for (let r = node.childGraph.minRank + 1; r <= node.childGraph.maxRank; ++r) {
                            orderNode = new OrderNode(node, node.label);
                            orderGroups[r].addNode(orderNode);
                            let dstId = orderNode.id;
                            orderGraph.addEdge(new Edge(srcId, dstId, 1000000));
                            srcId = dstId;
                        }
                    }
                    outNodeMap.set(node, orderNode.id);
                });

                // add normal edges between nodes; for each pair of nodes, sum up the weights of edges in-between
                _.forEach(component.edges(), (edge: LayoutEdge) => {
                    const srcOrderNodeId = outNodeMap.get(subgraph.node(edge.src));
                    const dstOrderNodeId = inNodeMap.get(subgraph.node(edge.dst));
                    const orderEdge = orderGraph.edgeBetween(srcOrderNodeId, dstOrderNodeId);
                    if (orderEdge === undefined) {
                        orderGraph.addEdge(new Edge(srcOrderNodeId, dstOrderNodeId, edge.weight));
                    } else {
                        orderEdge.weight += edge.weight;
                    }
                });

                // do order
                orderGraph.order();

                // copy node order into layout graph
                _.forEach(orderGraph.nodes(), (orderNode: OrderNode) => {
                    Assert.assertNumber(orderNode.position, "position is not a valid number");
                    const layoutNode: LayoutNode = orderNode.reference;
                    if (layoutNode.childGraph !== null) {
                        layoutNode.indexes.push(orderNode.position);
                        layoutNode.index = Math.max(layoutNode.index, orderNode.position);
                    } else {
                        layoutNode.index = orderNode.position;
                    }
                });
            });
        });

        /**
         * STEP 2: ORDER CONNECTORS
         * In this step, scope insides and outsides are handled in the same order graph.
         * If there are nested scopes, they are flattened.
         */

        const orderGraph = new OrderGraph;
        const orderRanks = [];
        for (let r = 0; r <= graph.maxRank; ++r) {
            orderRanks[r] = new OrderRank();
            orderGraph.addRank(orderRanks[r]);
        }

        const connectorMap = new Map();
        const generalInMap = new Map();
        const generalOutMap = new Map();

        // add edges
        const addConnectorsForSubgraph = (subgraph: LayoutGraph) => {
            _.forEach(subgraph.components(), (component: LayoutComponent) => {
                // handle children first
                _.forEach(component.nodes(), (node: LayoutNode) => {
                    if (node.childGraph !== null) {
                        addConnectorsForSubgraph(node.childGraph);
                    }
                });

                _.forEach(component.ranks(), (rank: Array<LayoutNode>, r) => {
                    let index = 0;
                    _.forEach(rank, (node: LayoutNode) => {
                        if (node.childGraph !== null && node.childGraph.entryNode !== null) {
                            index += node.childGraph.maxIndex() + 1;
                            return; // do not add connectors for scope nodes
                        }
                        let connectorGroup;
                        if (node.childGraph === null || component.minRank() + r === node.rank) {
                            // add input connectors
                            connectorGroup = new OrderGroup(node, node.label);
                            connectorGroup.position = index;
                            orderRanks[node.rank].addGroup(connectorGroup);
                            _.forEach(node.inConnectors, (connector: LayoutConnector) => {
                                const connectorNode = new OrderNode(connector, connector.name);
                                connectorGroup.addNode(connectorNode);
                                connectorMap.set(connector, connectorNode.id);
                                if (connector.isScoped) {
                                    connectorMap.set(connector.counterpart, connectorNode.id);
                                }
                            });
                            if (node.inConnectors.length === 0) {
                                const inNode = new OrderNode(null, "generalInConnector");
                                connectorGroup.addNode(inNode);
                                generalInMap.set(node, inNode.id);
                            }
                        }
                        if (node.childGraph === null || component.minRank() + r === node.childGraph.maxRank) {
                            Assert.assertImplies(node.rankSpan > 1, !node.hasScopedConnectors, "multirank node with scoped connectors");
                            if (!node.hasScopedConnectors) {
                                // keep in- and out-connectors separated from each other if they are not scoped
                                connectorGroup = new OrderGroup(node, node.label);
                                orderRanks[node.rank + node.rankSpan - 1].addGroup(connectorGroup);
                            }

                            // add output connectors
                            _.forEach(node.outConnectors, (connector: LayoutConnector) => {
                                if (!connector.isScoped) {
                                    const connectorNode = new OrderNode(connector, connector.name);
                                    connectorGroup.addNode(connectorNode);
                                    connectorMap.set(connector, connectorNode.id);
                                }
                            });
                            if (node.outConnectors.length === 0) {
                                const outNode = new OrderNode(null, "generalOutConnector");
                                connectorGroup.addNode(outNode);
                                generalOutMap.set(node, outNode.id);
                            }
                        }
                        index++;
                    });
                });
            });
        };
        addConnectorsForSubgraph(graph);

        // add connector edges
        _.forEach(graph.allEdges(), (edge: LayoutEdge) => {
            let srcNode = edge.graph.node(edge.src);
            if (srcNode.childGraph !== null && srcNode.childGraph.exitNode !== null) {
                srcNode = srcNode.childGraph.exitNode;
            }
            let dstNode = edge.graph.node(edge.dst);
            if (dstNode.childGraph !== null && dstNode.childGraph.entryNode !== null) {
                dstNode = dstNode.childGraph.entryNode;
            }
            let srcOrderNodeId;
            if (edge.srcConnector !== null) {
                srcOrderNodeId = connectorMap.get(srcNode.connector("OUT", edge.srcConnector));
            } else {
                srcOrderNodeId = generalOutMap.get(srcNode);
            }
            let dstOrderNodeId;
            if (edge.dstConnector !== null) {
                dstOrderNodeId = connectorMap.get(dstNode.connector("IN", edge.dstConnector));
            } else {
                dstOrderNodeId = generalInMap.get(dstNode);
            }
            orderGraph.addEdge(new Edge(srcOrderNodeId, dstOrderNodeId, 1));
        });

        // order connectors
        orderGraph.order();

        // copy order information from order graph to layout graph
        _.forEach(orderGraph.groups(), (orderGroup: OrderGroup) => {
            Assert.assertNumber(orderGroup.position, "position is not a valid number");
            const layoutNode: LayoutNode = orderGroup.reference;
            if (layoutNode !== null) {
                const connectors = {"IN": [], "OUT": []};
                _.forEach(orderGroup.orderedNodes(), (orderNode: OrderNode) => {
                    if (orderNode.reference !== null) {
                        const connector = orderNode.reference;
                        connectors[connector.type].push(connector);
                        if (connector.isScoped) {
                            connectors["OUT"].push(connector.counterpart);
                        }
                    }
                });
                if (connectors["IN"].length > 0) {
                    layoutNode.inConnectors = connectors["IN"];
                }
                if (connectors["OUT"].length > 0) {
                    layoutNode.outConnectors = connectors["OUT"];
                }
            }
        });
    }

    /**
     * Assigns coordinates to the nodes, the connectors and the edges.
     * @param graph
     * @param offsetX
     * @param offsetY
     * @private
     */
    private _assignCoordinates(graph: LayoutGraph, offsetX: number = 0, offsetY: number = 0) {
        // 1. assign y
        const rankTops = _.fill(new Array(graph.maxRank + 2), Number.POSITIVE_INFINITY);
        const rankBottoms = _.fill(new Array(graph.maxRank + 1), Number.NEGATIVE_INFINITY);

        const globalRanks = graph.globalRanks();

        rankTops[0] = 0;
        for (let r = 0; r < globalRanks.length; ++r) {
            let maxBottom = 0;
            _.forEach(globalRanks[r], (node: LayoutNode) => {
                node.y = rankTops[r];
                _.forEach(node.parents(), (parent: LayoutNode) => {
                    if (parent.childGraph.minRank === node.rank) {
                        node.y += parent.padding;
                    }
                });
                let height = node.height;
                _.forEach(node.parents(), (parent: LayoutNode) => {
                    if (parent.childGraph.maxRank === node.rank) {
                        height += parent.padding;
                    }
                });
                maxBottom = Math.max(maxBottom, node.y + height);
            });
            rankBottoms[r] = maxBottom;
            rankTops[r + 1] = maxBottom + this._options["targetEdgeLength"];
        }

        // 2. assign x and set size; assign edge and connector coordinates

        /**
         * Also handles edges completely.
         * @param subgraph
         * @param offset
         */
        const assignX = (subgraph: LayoutGraph, offset: number) => {
            // place components next to each other
            let nextComponentX = offset;
            _.forEach(subgraph.components(), (component: LayoutComponent) => {
                let componentX = nextComponentX;
                const ranks = component.ranks();

                // create dependency graph from left to right
                const depGraph = new Graph<any, any>();
                for (let r = 0; r < ranks.length; ++r) {
                    for (let i = 0; i < ranks[r].length; ++i) {
                        if (depGraph.node(ranks[r][i].id) === undefined) {
                            const depId = depGraph.addNode(new Node(), ranks[r][i].id);
                        }
                    }
                    for (let i = 1; i < ranks[r].length; ++i) {
                        depGraph.addEdge(new Edge(ranks[r][i - 1].id, ranks[r][i].id));
                    }
                }
                Assert.assert(!depGraph.hasCycle(), "dependency graph has cycle");

                // assign minimum x to all nodes based on their left neighbor(s)
                _.forEach(depGraph.toposort(), (depNode: Node<any, any>) => {
                    const layoutNode = subgraph.node(depNode.id);
                    let left = componentX - this._options["targetEdgeLength"];
                    _.forEach(depGraph.inEdges(depNode.id), (inEdge: Edge<any, any>) => {
                        const leftNode = subgraph.node(inEdge.src);
                        Assert.assertNumber(leftNode.x, "invalid x for left node");
                        left = Math.max(left, leftNode.x + leftNode.width);
                    });

                    layoutNode.x = left + this._options["targetEdgeLength"];
                    if (layoutNode.childGraph !== null) {
                        assignX(layoutNode.childGraph, layoutNode.x + layoutNode.padding);
                    }
                });

                // find x for next component
                _.forEach(ranks, (rank: Array<LayoutNode>, r: number) => {
                    if (rank.length === 0) {
                        return;
                    }
                    const lastNode = _.last(rank);
                    nextComponentX = Math.max(nextComponentX, lastNode.x + lastNode.width + this._options["targetEdgeLength"]);
                });
            });

            // set parent bounding box
            if (subgraph.parentNode !== null) {
                const boundingBox = subgraph.boundingBox(false);
                subgraph.parentNode.updateSize({width: boundingBox.width + 2 * subgraph.parentNode.padding, height: boundingBox.height + 2 * subgraph.parentNode.padding});
                console.assert(subgraph.parentNode.width >= 0 && subgraph.parentNode.height >= 0, "node has invalid size", subgraph.parentNode);
                if (subgraph.entryNode !== null) {
                    subgraph.entryNode.setWidth(boundingBox.width);
                    subgraph.exitNode.setWidth(boundingBox.width);
                }
            }

            // place connectors
            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                this._placeConnectors(node);
            });

            // place edges
            _.forEach(subgraph.edges(), (edge: LayoutEdge) => {
                const startNode = subgraph.node(edge.src);
                if (startNode.isVirtual) {
                    // do not assign points to this edge
                    return;
                }

                let startPos = startNode.boundingBox().bottomCenter();
                if (edge.srcConnector !== null) {
                    let srcConnector = startNode.connector("OUT", edge.srcConnector);
                    if (srcConnector === undefined && startNode.childGraph !== null) {
                        const childGraph = <LayoutGraph>startNode.childGraph;
                        if (childGraph.exitNode !== null) {
                            srcConnector = childGraph.exitNode.connector("OUT", edge.srcConnector);
                        }
                    }
                    if (srcConnector !== undefined) {
                        startPos = srcConnector.position().add(new Vector(srcConnector.diameter / 2, srcConnector.diameter));
                    }
                }
                edge.points = [startPos];

                let startRank = startNode.rank;
                if (startNode.childGraph !== null) {
                    startRank += startNode.childGraph.maxRank - startNode.childGraph.minRank;
                }
                const startBottom = rankBottoms[startRank];
                if (startBottom > startPos.y) {
                    edge.points.push(new Vector(startPos.x, startBottom))
                }

                let nextNode = subgraph.node(edge.dst);
                let tmpEdge = null;
                while (nextNode.isVirtual) {
                    const nextPos = nextNode.position();
                    const nextTop = rankTops[nextNode.rank];
                    if (nextTop < nextPos.y) {
                        edge.points.push(new Vector(nextPos.x, nextTop)); // add point above
                    }
                    edge.points.push(nextPos);
                    edge.points.push(new Vector(nextPos.x, rankBottoms[nextNode.rank])); // add point below
                    tmpEdge = subgraph.outEdges(nextNode.id)[0];
                    nextNode = subgraph.node(tmpEdge.dst);
                }

                if (tmpEdge !== null) {
                    edge.dstConnector = tmpEdge.dstConnector;
                }
                let endPos = nextNode.boundingBox().topCenter();
                if (edge.dstConnector !== null) {
                    let dstConnector = nextNode.connector("IN", edge.dstConnector);
                    if (dstConnector === undefined && nextNode.childGraph !== null) {
                        const childGraph = <LayoutGraph>nextNode.childGraph;
                        if (childGraph.entryNode !== null) {
                            dstConnector = childGraph.entryNode.connector("IN", edge.dstConnector);
                        }
                    }
                    if (dstConnector !== undefined) {
                        endPos = dstConnector.position().add(new Vector(dstConnector.diameter / 2, 0));
                    }
                }
                const endTop = rankTops[nextNode.rank];
                if (endTop < endPos.y) {
                    edge.points.push(new Vector(endPos.x, endTop));
                }
                edge.points.push(endPos);
                if (tmpEdge !== null) {
                    edge.graph.removeEdge(edge.id);
                    edge.dst = tmpEdge.dst;
                    edge.dstConnector = tmpEdge.dstConnector;
                    edge.graph.addEdge(edge, edge.id);
                }
            });

            // remove virtual nodes and edges
            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                if (node.isVirtual) {
                    _.forEach(subgraph.inEdges(node.id), (inEdge) => {
                        subgraph.removeEdge(inEdge.id);
                    });
                    _.forEach(subgraph.outEdges(node.id), (outEdge) => {
                        subgraph.removeEdge(outEdge.id);
                    });
                    subgraph.removeNode(node.id);
                }
            });

        };
        assignX(graph, 0);
    }

    private _restoreCycles(graph: LayoutGraph) {
        _.forEach(graph.allEdges(), (edge: LayoutEdge) => {
            if (edge.isInverted) {
                edge.graph.invertEdge(edge.id);
                edge.points = _.reverse(edge.points);
                edge.isInverted = false;
            }
        });
    }

    private _placeConnectors(node: LayoutNode) {
        const SPACE = this._options['connectorSpacing'];
        let tmpInConnectors = [];
        let tmpOutConnectors = [];
        const firstConnector = node.inConnectors[0] || node.outConnectors[0];
        if (!firstConnector) {
            return; // no connectors
        }
        const CW = firstConnector.width;
        const inY = node.y - CW / 2;
        const outY = node.y + node.height - CW / 2;
        let inPointer = 0;
        let outPointer = 0;
        let x = node.x;

        const placeTmpConnectors = (x, tmpInConnectors: Array<LayoutConnector>, tmpOutConnectors: Array<LayoutConnector>) => {
            let length = Math.max(tmpInConnectors.length, tmpOutConnectors.length) * (CW + SPACE) - SPACE;
            let inSpace = SPACE;
            let inOffset = 0;
            if (tmpInConnectors.length < tmpOutConnectors.length) {
                inSpace = (length - (tmpInConnectors.length * CW)) / (tmpInConnectors.length + 1);
                inOffset = inSpace;
            }
            let outSpace = SPACE;
            let outOffset = 0;
            if (tmpOutConnectors.length < tmpInConnectors.length) {
                outSpace = (length - (tmpOutConnectors.length * CW)) / (tmpOutConnectors.length + 1);
                outOffset = outSpace;
            }
            _.forEach(tmpInConnectors, (connector, i) => {
                connector.x = x + inOffset + i * (inSpace + CW);
                connector.y = inY;
            });
            _.forEach(tmpOutConnectors, (connector, i) => {
                connector.x = x + outOffset + i * (outSpace + CW);
                connector.y = outY;
            });
            return x + length + SPACE;
        }

        while (inPointer < node.inConnectors.length || outPointer < node.outConnectors.length) {
            if (inPointer === node.inConnectors.length) {
                tmpOutConnectors.push(node.outConnectors[outPointer++]);
            } else if(outPointer === node.outConnectors.length) {
                tmpInConnectors.push(node.inConnectors[inPointer++]);
            } else {
                let scoped = false;
                if (node.inConnectors[inPointer].isScoped) {
                    scoped = true;
                    while (!node.outConnectors[outPointer].isScoped) {
                        tmpOutConnectors.push(node.outConnectors[outPointer++]);
                    }
                } else if (node.outConnectors[outPointer].isScoped) {
                    scoped = true;
                    while (!node.inConnectors[inPointer].isScoped) {
                        tmpInConnectors.push(node.inConnectors[inPointer++]);
                    }
                } else {
                    tmpInConnectors.push(node.inConnectors[inPointer++]);
                    tmpOutConnectors.push(node.outConnectors[outPointer++]);
                }
                if (scoped) {
                    x = placeTmpConnectors(x, tmpInConnectors, tmpOutConnectors);
                    let scopedConnectorIn = node.inConnectors[inPointer++];
                    scopedConnectorIn.x = x;
                    scopedConnectorIn.y = inY;
                    let scopedConnectorOut = node.outConnectors[outPointer++];
                    scopedConnectorOut.x = x;
                    scopedConnectorOut.y = outY;
                    x += CW + SPACE;
                    tmpInConnectors = [];
                    tmpOutConnectors = [];
                }
            }
        }
        placeTmpConnectors(x, tmpInConnectors, tmpOutConnectors);
        let auxBox = new Box(
            node.x,
            node.y,
            Math.max(node.inConnectors.length, node.outConnectors.length) * (SPACE + CW) - SPACE,
            CW
        ).centerIn(node.boundingBox());
        _.forEach(node.inConnectors, (connector: LayoutConnector) => {
            connector.translate(auxBox.x - node.x, 0);
        });
        _.forEach(node.outConnectors, (connector: LayoutConnector) => {
            connector.translate(auxBox.x - node.x, 0);
        });
    }
}
