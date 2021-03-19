import * as _ from "lodash";
import Layouter from "./layouter";
import LayoutGraph from "../layoutGraph/layoutGraph";
import LayoutNode from "../layoutGraph/layoutNode";
import LayoutEdge from "../layoutGraph/layoutEdge";
import OrderRank from "../order/orderRank";
import OrderGroup from "../order/orderGroup";
import LayoutConnector from "../layoutGraph/layoutConnector";
import OrderNode from "../order/orderNode";
import OrderGraph from "../order/orderGraph";
import Edge from "../graph/edge";
import Component from "../graph/component";
import LayoutComponent from "../layoutGraph/layoutComponent";
import Box from "../geometry/box";
import Vector from "../geometry/vector";
import Assert from "../util/assert";
import Graph from "../graph/graph";
import Node from "../graph/node";

export default class SugiyamaLayouter extends Layouter
{

    protected doLayout(graph: LayoutGraph): void {
        if (graph.nodes().length === 0) {
            return;
        }

        this._removeCycles(graph);

        this._assignRanks(graph);
        Assert.assertNone(graph.allNodes(), node => node.rank < 0, "invalid rank assignment");

        this._addVirtualNodes(graph);
        Assert.assertNone(graph.allEdges(), edge => {
            const srcNode = edge.graph.node(edge.src)
            let srcRank = srcNode.rank;
            srcRank += (srcNode.childGraph !== null ? srcNode.childGraph.maxRank - srcNode.childGraph.minRank : 0)
            return srcRank + 1 !== edge.graph.node(edge.dst).rank;
        }, "edge not between neighboring ranks");

        this._orderRanks(graph);

        this._assignCoordinates(graph);
        Assert.assertNone(graph.allNodes(), node => typeof node.y !== "number" || isNaN(node.y), "invalid y assignment");
        Assert.assertNone(graph.allNodes(), node => typeof node.x !== "number" || isNaN(node.x), "invalid x assignment");

        this._placeConnectors(graph);
        this._matchEdgesToConnectors(graph);
        this._restoreCycles(graph);
    }

    private _removeCycles(graph: LayoutGraph): void {
        _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
            if (subgraph.mayHaveCycles) {
                _.forEach(subgraph.components(), (component: LayoutComponent) => {
                    const positions = [];
                    _.forEach(component.bfs(), (node: LayoutNode, pos: number) => {
                        positions[node.id] = pos;
                    });
                    _.forEach(component.edges(), (edge: LayoutEdge) => {
                        if (positions[edge.dst] < positions[edge.src]) {
                            subgraph.invertEdge(edge.id);
                        }
                    });
                });
            }
        });

    }

    private _assignRanks(graph: LayoutGraph, parentRank: number = 0): void {
        if (graph.isRanked) {
            return;
        }
        graph.minRank = parentRank;
        graph.maxRank = parentRank;
        _.forEach(graph.components(), (component: LayoutComponent) => {
            const sources = component.sources();
            const nodesBySource = new Array(sources.length);
            const sourceByNode = new Array(component.maxId() + 1);

            // do bfs starting from one source at a time and stopping when finding nodes already assigned by other source
            _.forEach(sources, (source: LayoutNode, s: number) => {
                nodesBySource[s] = [];
                const sortedNodes = _.intersection(component.toposort(), component.bfs(source.id));

                for (let n = 0; n < sortedNodes.length; ++n) {
                    const node = sortedNodes[n];

                    // calculate minimum rank based on all top neighbors
                    let rank = parentRank;
                    _.forEach(graph.inEdges(node.id), (inEdge: LayoutEdge) => {
                        if (sourceByNode[inEdge.src] !== s) {
                            return;
                        }
                        const neighbor = graph.node(inEdge.src);
                        let next = neighbor.rank + 1;
                        if (neighbor.childGraph !== null) {
                            next += neighbor.childGraph.maxRank - neighbor.childGraph.minRank;
                        }
                        rank = Math.max(rank, next);
                    });

                    if (node.rank !== null) {
                        if (node.rank < rank) {
                            // update other sources' nodes
                            const offset = rank - node.rank;
                            for (let tmpS = 0; tmpS < s; ++tmpS) {
                                _.forEach(nodesBySource[tmpS], (node: LayoutNode) => {
                                    node.updateRank(node.rank + offset);
                                });
                            }
                        } else if (node.rank > rank) {
                            // update this source's nodes
                            const offset = node.rank - rank;
                            _.forEach(nodesBySource[s], (node: LayoutNode) => {
                                node.updateRank(node.rank + offset);
                            });
                        }
                        break;
                    }

                    node.rank = rank;
                    nodesBySource[s].push(node);
                    sourceByNode[node.id] = s;
                    if (node.childGraph !== null) {
                        this._assignRanks(node.childGraph, node.rank);
                    }
                }
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
            graph.isRanked = true;
        });
    }


    private BACKUP2_assignRanks(graph: LayoutGraph, parentRank: number = 0): void {
        if (graph.isRanked) {
            return;
        }
        graph.minRank = parentRank;
        graph.maxRank = parentRank;

        _.forEach(graph.components(), (component: LayoutComponent) => {
            const sources = component.sources();
            const nodesBySource = new Array(sources.length);
            const sourceByNode = new Array(component.maxId() + 1);


            let maxRank = parentRank;

            const bfs = (source: LayoutNode, s: number) => {
                nodesBySource[s] = [];
                const visited = _.fill(new Array(component.maxId() + 1), false);
                const queue = [];
                let queuePointer = 0;
                queue.push(source);
                while (queuePointer < queue.length) {
                    const node = queue[queuePointer++];
                    // calculate minimum rank based on all top neighbors
                    let rank = parentRank;
                    _.forEach(graph.inEdges(node.id), (inEdge: LayoutEdge) => {
                        if (sourceByNode[inEdge.src] !== s) {
                            return;
                        }
                        let neighbor = graph.node(inEdge.src);
                        let nextRank = neighbor.rank + 1;
                        if (neighbor.childGraph !== null) {
                            nextRank += neighbor.childGraph.maxRank - neighbor.childGraph.minRank;
                        }
                        rank = Math.max(rank, nextRank);
                    });

                    if (sourceByNode[node.id] !== undefined && sourceByNode[node.id] !== s) {
                        if (node.rank < rank) {
                            // update other sources' nodes
                            const offset = rank - node.rank;

                            for (let tmpS = 0; tmpS < s; ++tmpS) {
                                _.forEach(nodesBySource[tmpS], (node: LayoutNode) => {
                                    node.updateRank(node.rank + offset);
                                });
                            }
                        } else if (rank > node.rank) {
                            // update this source's nodes
                            const offset = node.rank - rank;
                            _.forEach(nodesBySource[s], (node: LayoutNode) => {
                                node.updateRank(node.rank + offset);
                            });
                        }
                        break;
                    }
                    node.rank = Math.max(node.rank, rank);
                    maxRank = Math.max(maxRank, rank);
                    if (node.childGraph !== null) {
                        if (node.childGraph.isRanked) {
                            node.childGraph.updateRank(rank);
                        } else {
                            this._assignRanks(node.childGraph, rank);
                        }
                        maxRank = Math.max(maxRank, rank + node.childGraph.maxRank - node.childGraph.minRank);
                    }
                    nodesBySource[s].push(node);
                    sourceByNode[node.id] = s;
                    _.forEach(graph.outEdges(node.id), (outEdge: LayoutEdge) => {
                        queue.push(graph.node(outEdge.dst));
                    });
                }
            }

            // first act like every node would span just one rank
            // do bfs starting from one source at a time and stopping when finding nodes already assigned by other source
            _.forEach(sources, (source: LayoutNode, s: number) => {
                bfs(source, s);
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
            graph.isRanked = true;
        });
    }

    private BACKUP_assignRanks(graph: LayoutGraph, parentRank: number = 0): void {
        graph.minRank = parentRank;
        graph.maxRank = parentRank;
        _.forEach(graph.components(), (component: LayoutComponent) => {
            let componentMaxRank = parentRank;
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
                componentMaxRank = Math.max(componentMaxRank, nextRank - 1);
            });
            graph.maxRank = Math.max(graph.maxRank, componentMaxRank);
            component.setMinRank(parentRank);
            component.setMaxRank(componentMaxRank);
        });

        // sinks are now aligned at top

        if (this._options['alignInAndOut']) {
            // align outputs at bottom
            _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
                _.forEach(subgraph.components(), (component: LayoutComponent) => {
                    _.forEach(component.sinks(), (sink: LayoutNode) => {
                        let rank = component.maxRank();
                        if (sink.childGraph !== null) {
                            rank -= (sink.childGraph.maxRank - sink.childGraph.minRank);
                        }
                        subgraph.node(sink.id).rank = rank;
                    });
                });
            });
        } else {
            // move everything down as far as possible
            _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
                _.forEach(subgraph.components(), (component: LayoutComponent) => {
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
                        subgraph.node(node.id).updateRank(minRank[node.id]);
                    });
                    component.updateMinMaxRank();
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
            if (srcRank + 1 < dstNode.rank) {
                let tmpSrcId = srcNode.id;
                let tmpDstId;
                const dstConnector = edge.dstConnector;
                for (let tmpDstRank = srcRank + 1; tmpDstRank < dstNode.rank; ++tmpDstRank) {
                    const newNode = new LayoutNode({width: 0, height: 0});
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

        // add a virtual node in every child graph
        _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
            if (subgraph.nodes().length === 0) {
                const newNode = new LayoutNode({width: 0, height: 0});
                newNode.rank = subgraph.minRank;
                newNode.label = "virtual";
                subgraph.addNode(newNode);
            }
        });
    }

    private _orderRanks(graph: LayoutGraph) {
        const orderGraph = new OrderGraph();
        const orderRanks = [];
        for (let r = 0; r <= graph.maxRank; ++r) {
            orderRanks[r] = new OrderRank();
            orderGraph.addRank(orderRanks[r]);
        }
        const nodeMap = new Map();
        const connectorMap = new Map();
        const generalInMap = new Map();
        const generalOutMap = new Map();

        // add nodes
        _.forEach(graph.allNodes(), (node: LayoutNode) => {
            if (node.childGraph !== null && node.childGraph.entryNode !== null) {
                return; // skip scope nodes
            }
            let group = new OrderGroup(node);
            orderRanks[node.rank].addGroup(group);
            nodeMap.set(node, group.id);
            _.forEach(node.inConnectors, (connector: LayoutConnector) => {
                const connectorNode = new OrderNode(connector);
                group.addNode(connectorNode);
                connectorMap.set(connector, connectorNode.id);
                if (connector.isScoped) {
                    connectorMap.set(connector.counterpart, connectorNode.id);
                }
            });
            if (node.inConnectors.length === 0) {
                const inNode = new OrderNode(null);
                group.addNode(inNode);
                generalInMap.set(node, inNode.id);
            }

            // for nodes spanning multiple ranks*, insert a copy in each rank
            // add edges with infinite weight between those copies to prevent any crossings
            // *scope nodes are excluded here (see above)
            if (node.childGraph !== null) {
                const orderNode = new OrderNode(null);
                group.addNode(orderNode);
                let srcId = orderNode.id;
                for (let r = node.childGraph.minRank + 1; r <= node.childGraph.maxRank; ++r) {
                    group = new OrderGroup(node);
                    orderRanks[r].addGroup(group);
                    const orderNode = new OrderNode(null);
                    group.addNode(orderNode);
                    let dstId = orderNode.id;
                    orderGraph.addEdge(new Edge(srcId, dstId, 1000000));
                }
            }

            _.forEach(node.outConnectors, (connector: LayoutConnector) => {
                if (!connector.isScoped) {
                    const connectorNode = new OrderNode(connector);
                    group.addNode(connectorNode);
                    connectorMap.set(connector, connectorNode.id);
                }
            });
            if (node.outConnectors.length === 0) {
                const outNode = new OrderNode(null);
                group.addNode(outNode);
                generalOutMap.set(node, outNode.id);
            }
        });

        // add edges
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
            //let weight = srcNode.graph.entryNode !== null ? 1000 : 1;
            let weight = 1;
            orderGraph.addEdge(new Edge(srcOrderNodeId, dstOrderNodeId, weight));
        });

        // order
        orderGraph.order();

        // copy order information from order graph to layout graph
        _.forEach(orderGraph.groups(), (orderGroup: OrderGroup) => {
            const layoutNode: LayoutNode = orderGroup.reference;
            if (layoutNode.childGraph !== null && layoutNode.childGraph.entryNode === null) {
                layoutNode.indexes.push(orderGroup.position);
                layoutNode.index = Math.max(layoutNode.index, orderGroup.position);
            } else {
                layoutNode.index = orderGroup.position;
            }
            //console.log("index/indexes", layoutNode.rank, layoutNode.label, layoutNode.index, layoutNode.indexes);
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
        });

        const assignScopeIndexes = (graph: LayoutGraph) => {
            _.forEach(graph.nodes(), (node: LayoutNode) => {
                if (node.childGraph !== null) {
                    assignScopeIndexes(node.childGraph);
                    if (node.childGraph.entryNode !== null) {
                        _.forEach(node.childGraph.ranks(), (rank: Array<LayoutNode>) => {
                            let firstChildIndex = rank[0].indexes[0] || rank[0].index;
                            if (firstChildIndex.constructor === Array) {
                                firstChildIndex = rank[0].index[0];
                            }
                            node.indexes.push(firstChildIndex);
                            node.index = Math.max(node.index, firstChildIndex);
                        });
                    }
                }
            });
        };
        assignScopeIndexes(graph);
    }

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

        // 2. assign x and set size

        /**
         * Also handles edges completely.
         * @param subgraph
         * @param offset
         */
        const assignedSubgraphs = new Set();
        const assignX = (subgraph: LayoutGraph, offset: number) => {
            if (assignedSubgraphs.has(subgraph)) {
                return;
            }
            assignedSubgraphs.add(subgraph);
            // place components next to each other
            //console.log("offset", offset);
            let nextComponentX = offset;
            _.forEach(subgraph.components(), (component: LayoutComponent) => {
                let componentX = nextComponentX;
                const ranks = component.ranks();

                // assign minimum x to every leftmost node on a rank
                for (let r = 0; r < ranks.length; ++r) {
                    ranks[r][0].x = componentX;
                    if (ranks[r][0].childGraph !== null && r === ranks[r][0].rank - component.minRank()) {
                        assignX(ranks[r][0].childGraph, ranks[r][0].x + ranks[r][0].padding);
                    }
                }

                // create dependency graph from left to right
                const depGraph = new Graph<any, any>();
                for (let r = 0; r < ranks.length; ++r) {
                    for (let i = 0; i < ranks[r].length; ++i) {
                        if (depGraph.node(ranks[r][i].id) === undefined) {
                            depGraph.addNode(new Node(), ranks[r][i].id);
                        }
                    }
                    for (let i = 1; i < ranks[r].length; ++i) {
                        depGraph.addEdge(new Edge(ranks[r][i - 1].id, ranks[r][i].id));
                    }
                }

                // assign minimum x to all nodes based on their left neighbor(s)
                _.forEach(depGraph.toposort(), (depNode: Node<any, any>) => {
                    const layoutNode = subgraph.node(depNode.id);
                    let left = 0;
                    _.forEach(depGraph.inEdges(depNode.id), (inEdge: Edge<any, any>) => {
                        const leftNode = subgraph.node(inEdge.src);
                        Assert.assertNumber(leftNode.x, "invalid x for left node");
                        left = Math.max(left, leftNode.x + leftNode.width);
                    });
                    if (left === 0) {
                        return; // leftmost node already assigned
                    }
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
                    //console.log("lastNode", lastNode);
                    nextComponentX = Math.max(nextComponentX, lastNode.x + lastNode.width + this._options["targetEdgeLength"]);
                });

                // assign edges
                _.forEach(subgraph.edges(), (edge: LayoutEdge) => {
                    const startNode = subgraph.node(edge.src);
                    if (startNode.width === 0) {
                        // start node is virtual, do not assign points to this edge
                        return;
                    }

                    const startPos = startNode.boundingBox().bottomCenter();
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
                    while (nextNode.width === 0) {
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
                    const endPos = nextNode.boundingBox().topCenter();
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
                    if (node.width === 0) {
                        _.forEach(subgraph.inEdges(node.id), (inEdge) => {
                            subgraph.removeEdge(inEdge.id);
                        });
                        _.forEach(subgraph.outEdges(node.id), (outEdge) => {
                            subgraph.removeEdge(outEdge.id);
                        });
                        subgraph.removeNode(node.id);
                    }
                });

                // set parent bounding box
                if (subgraph.parentNode !== null) {
                    const boundingBox = subgraph.boundingBox();
                    subgraph.parentNode.setSize({width: boundingBox.width + 2 * subgraph.parentNode.padding, height: boundingBox.height + 2 * subgraph.parentNode.padding});
                    console.assert(subgraph.parentNode.width >= 0 && subgraph.parentNode.height >= 0, "node has invalid size", subgraph.parentNode);
                    if (subgraph.entryNode !== null) {
                        subgraph.entryNode.setWidth(boundingBox.width);
                        subgraph.exitNode.setWidth(boundingBox.width);
                    }
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

    private _placeConnectors(graph: LayoutGraph) {
        const SPACE = this._options['connectorSpacing'];
        _.forEach(graph.allNodes(), (node: LayoutNode) => {
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
        });
    }
}