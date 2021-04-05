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
import RankGraph from "../rank/rankGraph";
import RankNode from "../rank/rankNode";
import Timer from "../util/timer";
import Vector from "../geometry/vector";
import LayoutBundle from "../layoutGraph/layoutBundle";
import LevelNode from "../levelGraph/levelNode";
import LevelGraph from "../levelGraph/levelGraph";

export default class SugiyamaLayouter extends Layouter
{

    protected doLayout(graph: LayoutGraph): void {
        if (graph.nodes().length === 0) {
            return;
        }
        Timer.start("doLayout()");

        // STEP 1: REMOVE CYCLES
        Timer.start("removeCycles");
        this._removeCycles(graph);
        Timer.stop("removeCycles");
        Assert.assert(!graph.hasCycle(), "graph has cycle");

        // STEP 2: ASSIGN RANKS
        Timer.start("assignRanks");
        this._assignRanks(graph);
        Timer.stop("assignRanks");
        Assert.assertNone(graph.allNodes(), node => node.rank < 0, "invalid rank assignment");

        // STEP 3: ADD VIRTUAL NODES
        Timer.start("addVirtualNodes");
        this._addVirtualNodes(graph);
        Timer.stop("addVirtualNodes");
        Assert.assertNone(graph.allEdges(), edge => {
            const srcNode = edge.graph.node(edge.src)
            return srcNode.rank + srcNode.rankSpan !== edge.graph.node(edge.dst).rank;
        }, "edge not between neighboring ranks");

        Timer.start("orderRanks");
        this._orderRanks(graph);
        Timer.stop("orderRanks");

        // STEP 4: ASSIGN COORDINATES
        Timer.start("assignCoordinates");
        this._assignCoordinates(graph);
        Timer.stop("assignCoordinates");
        Assert.assertNone(graph.allNodes(), node => typeof node.y !== "number" || isNaN(node.y), "invalid y assignment");
        Assert.assertNone(graph.allNodes(), node => typeof node.x !== "number" || isNaN(node.x), "invalid x assignment");

        // STEP 5: RESTORE CYCLES
        Timer.start("restoreCycles");
        this._restoreCycles(graph);
        Timer.stop("restoreCycles");

        Timer.stop("doLayout()");
    }

    private _removeCycles(graph: LayoutGraph): void {
        _.forEach(graph.allGraphs(), (subgraph: LayoutGraph) => {
            if (subgraph.mayHaveCycles) {
                // remove normal cycles
                subgraph.removeCycles();

                // remove self-loops
                _.forEach(subgraph.edges(), (edge: LayoutEdge) => {
                    if (edge.src === edge.dst) {
                        subgraph.node(edge.src).selfLoop = edge;
                        subgraph.removeEdge(edge.id);
                    }
                });
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
                    if (node.childGraph.maxRank === Number.POSITIVE_INFINITY) {
                        throw new Error("INIFINITE MAX RANK");
                    }
                    node.rankSpan = node.childGraph.maxRank - node.childGraph.minRank + 1;
                }
            });

            const rankGraph = new RankGraph();
            _.forEach(component.nodes(), node => {
                rankGraph.addNode(new RankNode(node.label()), node.id);
            });
            _.forEach(component.edges(), edge => {
                rankGraph.addEdge(new Edge(edge.src, edge.dst, component.node(edge.src).rankSpan));
            });
            rankGraph.rank();

            _.forEach(component.nodes(), node => {
                node.rank = rankGraph.node(node.id).rank;
            });

            if (this._options['alignInAndOut']) {
                _.forEach(component.sources, (source: LayoutNode) => {
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
                    newNode.setLabel("virtual node on edge from" + srcNode.label() + " to " + dstNode.label());
                    tmpDstId = edge.graph.addNode(newNode);
                    if (tmpDstRank === srcRank + 1) {
                        // original edge is redirected from source to first virtual node
                        edge.graph.removeEdge(edge.id);
                        edge.dst = tmpDstId;
                        edge.dstConnector = null;
                        edge.graph.addEdge(edge, edge.id);
                    } else {
                        const tmpEdge = new LayoutEdge(tmpSrcId, tmpDstId);
                        tmpEdge.weight = Number.POSITIVE_INFINITY;
                        edge.graph.addEdge(tmpEdge);
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
                newNode.setLabel("placeholder inside parent " + (subgraph.parentNode !== null ? subgraph.parentNode.label() : ""));
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
                _.forEach(component.levelGraph().nodes(), (node: LevelNode) => {
                    let orderNode = new OrderNode(node, node.label());
                    orderGroups[node.rank].addNode(orderNode, node.id);
                });

                // add normal edges between nodes; for each pair of nodes, sum up the weights of edges in-between
                _.forEach(component.levelGraph().edges(), (edge: Edge<any, any>) => {
                    orderGraph.addEdge(new Edge(edge.src, edge.dst, edge.weight));
                });

                // do order
                orderGraph.order(false, false);

                console.log("NUMNODES", orderGraph.nodes())
                if (orderGraph.nodes().length === 28) {
                    orderGraph.storeLocal();
                }

                // copy node order into layout graph
                const newOrderNodes = [];
                _.forEach(orderGraph.nodes(), (orderNode: OrderNode) => {
                    Assert.assertNumber(orderNode.position, "position is not a valid number");
                    let levelNode: LevelNode = orderNode.reference;
                    if (levelNode === null) {
                        // virtual node was created by orderGraph.order() => add this node also to layout graph
                        const newNode = new LayoutNode({width: 0, height: 0}, 0, true);
                        const newNodeId = subgraph.addNode(newNode);
                        component.addNode(newNodeId);
                        orderNode.reference = newNode;
                        newOrderNodes.push(orderNode);
                        component.levelGraph().addLayoutNode(newNode);
                        levelNode = component.levelGraph().inNode(newNodeId);
                    }
                    levelNode.rank = orderNode.rank;
                    levelNode.layoutNode.rank = levelNode.rank;
                    levelNode.position = orderNode.position;
                });
                _.forEach(newOrderNodes, (orderNode: OrderNode) => {
                    _.forEach(orderGraph.inEdges(orderNode.id), inEdge => {
                        const newEdge = new LayoutEdge(orderGraph.node(inEdge.src).reference.id, orderNode.reference.id);
                        const newEdgeId = subgraph.addEdge(newEdge);
                        component.addEdge(newEdgeId);
                        component.levelGraph().addLayoutEdge(newEdge);
                    });
                    _.forEach(orderGraph.outEdges(orderNode.id), outEdge => {
                        const newEdge = new LayoutEdge(orderGraph.node(outEdge.src).reference.id, orderNode.reference.id);
                        const newEdgeId = subgraph.addEdge(newEdge);
                        component.addEdge(newEdgeId);
                        component.levelGraph().addLayoutEdge(newEdge);
                    });
                })
                component.levelGraph().invalidateRanks();
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

                _.forEach(component.levelGraph().ranks(), (rank: Array<LevelNode>, r) => {
                    let index = 0;
                    _.forEach(rank, (levelNode: LevelNode) => {
                        const node = levelNode.layoutNode;
                        if (node.childGraph !== null && node.childGraph.entryNode !== null) {
                            index += node.childGraph.maxIndex() + 1;
                            return; // do not add connectors for scope nodes
                        }
                        let connectorGroup;
                        if (node.childGraph === null || component.minRank() + r === node.rank) {
                            // add input connectors
                            connectorGroup = new OrderGroup(node, node.label());
                            connectorGroup.position = index;
                            console.log("node.rank", node.rank, "orderRanks", orderRanks);
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
                                connectorGroup = new OrderGroup(node, node.label());
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
        // assign y
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

        // assign x and set size; assign edge and connector coordinates

        const placeSubgraph = (subgraph: LayoutGraph, offset: number) => {
            // place all subgraphs in order to know their size
            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                if (node.childGraph !== null) {
                    placeSubgraph(node.childGraph, node.padding);
                }
            });

            // assign x
            let x = offset;
            _.forEach(subgraph.components(), (component: LayoutComponent) => {
                this._assignX(component, x);
                x += component.boundingBox().width + this._options["targetEdgeLength"];
                _.forEach(component.nodes(), (node: LayoutNode) => {
                    if (node.childGraph !== null) {
                        //node.childGraph.translateElements(x, 0);
                    }
                });
            });

            // place self-loops
            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                if (node.selfLoop !== null) {
                    node.selfLoop.points = [
                        new Vector(node.x + node.width - this._options["targetEdgeLength"], node.y + node.height - 10),
                        new Vector(node.x + node.width, node.y + node.height - 10),
                        new Vector(node.x + node.width, node.y + 10),
                        new Vector(node.x + node.width - this._options["targetEdgeLength"], node.y + 10),
                    ];
                }
            });

            // set parent bounding box
            if (subgraph.parentNode !== null) {
                const boundingBox = subgraph.boundingBox(false);
                subgraph.parentNode.updateSize({width: boundingBox.width + 2 * subgraph.parentNode.padding, height: boundingBox.height + 2 * subgraph.parentNode.padding});
                if (subgraph.parentNode.selfLoop !== null) {
                    subgraph.parentNode.updateSize({width: subgraph.parentNode.width + this._options["targetEdgeLength"], height: 0});
                }
                Assert.assert(subgraph.parentNode.width >= 0 && subgraph.parentNode.height >= 0, "node has invalid size", subgraph.parentNode);
                if (subgraph.entryNode !== null) {
                    const left = boundingBox.x;
                    subgraph.entryNode.setWidth(boundingBox.width);
                    subgraph.entryNode.setPosition(new Vector(left, subgraph.entryNode.y));
                    subgraph.exitNode.setWidth(boundingBox.width);
                    subgraph.exitNode.setPosition(new Vector(left, subgraph.exitNode.y));
                }
            }

            // place connectors
            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                this._placeConnectors(node, rankTops, rankBottoms);
            });

            // place edges (self-loops handled above)
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

                if (edge.bundle !== null && edge.bundle.connectors.length > 1 && edge.srcConnector !== null) {
                    edge.points.push(new Vector(edge.bundle.x, edge.bundle.y));
                } else {
                    const startBottom = rankBottoms[startNode.rank + startNode.rankSpan - 1];
                    if (startBottom > startPos.y) {
                        edge.points.push(new Vector(startPos.x, startBottom))
                    }
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
                if (edge.bundle !== null && edge.bundle.connectors.length > 1 && edge.dstConnector !== null) {
                    //console.log(edge.bundle);
                    edge.points.push(new Vector(edge.bundle.x, edge.bundle.y));
                } else {
                    const startBottom = rankBottoms[startNode.rank + startNode.rankSpan - 1];
                    if (startBottom > startPos.y) {
                        const endTop = rankTops[nextNode.rank];
                        if (endTop < endPos.y) {
                            edge.points.push(new Vector(endPos.x, endTop));
                        }
                    }
                }
                edge.points.push(endPos);
                if (tmpEdge !== null) {
                    edge.graph.removeEdge(edge.id);
                    edge.dst = tmpEdge.dst;
                    edge.graph.addEdge(edge, edge.id);
                }
            });

            _.forEach(subgraph.nodes(), (node: LayoutNode) => {
                // remove virtual nodes and edges
                if (node.isVirtual) {
                    _.forEach(subgraph.inEdges(node.id), (inEdge) => {
                        subgraph.removeEdge(inEdge.id);
                    });
                    _.forEach(subgraph.outEdges(node.id), (outEdge) => {
                        subgraph.removeEdge(outEdge.id);
                    });
                    subgraph.removeNode(node.id);
                }

                // place self-loops visually outside their state
                if (node.selfLoop !== null) {
                    node.setWidth(node.width - this._options["targetEdgeLength"]);
                }

            });
        };
        placeSubgraph(graph, 0);
    }

    private _assignX(component: LayoutComponent, offset = 0) {
        /*const levelGraph = component.levelGraph();
        const ranks = levelGraph.ranks();

        // create dependency graph from left to right
        const depGraph = new Graph<any, any>();
        for (let r = 0; r < ranks.length; ++r) {
            for (let i = 0; i < ranks[r].length; ++i) {
                if (depGraph.node(ranks[r][i].layoutNode.id) === undefined) {
                    depGraph.addNode(new Node(), ranks[r][i].id);
                }
            }
            for (let i = 1; i < ranks[r].length; ++i) {
                depGraph.addEdge(new Edge(ranks[r][i - 1].id, ranks[r][i].id));
            }
        }
        Assert.assert(!depGraph.hasCycle(), "dependency graph has cycle");

        // assign minimum x to all nodes based on their left neighbor(s)
        _.forEach(depGraph.toposort(), (depNode: Node<any, any>) => {
            const levelNode = levelGraph.node(depNode.id);
            const layoutNode = levelNode.layoutNode;
            let left = offset - this._options["targetEdgeLength"];
            _.forEach(depGraph.inEdges(depNode.id), (inEdge: Edge<any, any>) => {
                const leftNode = levelGraph.node(inEdge.src);
                Assert.assertNumber(leftNode.x, "invalid x for left node");
                left = Math.max(left, leftNode.x + leftNode.width);
            });

            levelNode.x = left + this._options["targetEdgeLength"];
            layoutNode.x = levelNode.x;
        });*/
        const alignGraphs = [
            component.levelGraph().clone(),
            component.levelGraph().clone(),
            component.levelGraph().clone(),
            component.levelGraph().clone(),
        ];
        this._alignMedian(alignGraphs[0], "UP", "LEFT");
        this._alignMedian(alignGraphs[1], "UP", "RIGHT");
        this._alignMedian(alignGraphs[2], "DOWN", "LEFT");
        this._alignMedian(alignGraphs[3], "DOWN", "RIGHT");

        // align left-most and right-most nodes
        let minMaxX = Number.POSITIVE_INFINITY;
        _.forEach(alignGraphs, (alignGraph: LevelGraph) => {
            minMaxX = Math.min(minMaxX, alignGraph.maxX());
        });
        _.forEach([1, 3], (i: number) => {
            const alignGraph = alignGraphs[i];
            const maxX = alignGraph.maxX();
            if (maxX === minMaxX) {
                return; // no need to adjust this graph
            }
            const diff = minMaxX - maxX;
            _.forEach(alignGraph.nodes(), (node: LevelNode) => {
                node.x += diff;
            });
        });
        let minX = Number.POSITIVE_INFINITY;

        _.forEach(component.levelGraph().nodes(), (node: LevelNode) => {
            let xs = _.sortBy(_.map(alignGraphs, alignGraph => alignGraph.node(node.id).x));
            let x = (xs[1] + xs[2]) / 2;
            //x = alignGraphs[1].node(node.id).x;
            x -= node.layoutNode.width / 2;
            minX = Math.min(minX, x);
            node.layoutNode.setPosition(new Vector(offset + x, node.layoutNode.y));
        });
        const diff = 0 - minX;
        _.forEach(component.nodes(), (node: LayoutNode) => {
            node.translate(diff, 0);
        });
    }

    private _alignMedian(levelGraph: LevelGraph, neighbors: "UP" | "DOWN", preference: "LEFT" | "RIGHT") {
        const ranks = levelGraph.ranks();
        const firstRank = (neighbors === "UP" ? 1 : (ranks.length - 2));
        const lastRank = (neighbors === "UP" ? (ranks.length - 1) : 0);
        const verticalDir = (neighbors === "UP" ? 1 : -1);
        const neighborOutMethod = (neighbors === "UP" ? "outEdges" : "inEdges");
        const neighborInMethod = (neighbors === "UP" ? "inEdges" : "outEdges");
        const neighborEdgeOutAttr = (neighbors === "UP" ? "src" : "dst");
        const neighborEdgeInAttr = (neighbors === "UP" ? "dst" : "src");

        const blockPerNode = new Array(levelGraph.maxId() + 1);
        const blockWidths = new Array(levelGraph.maxId() + 1);
        const blockGraph = new RankGraph();

        const r = firstRank - verticalDir;
        let blockId = 0;
        for (let n = 0; n < ranks[r].length; ++n) {
            blockGraph.addNode(new RankNode(blockId.toString()));
            blockPerNode[ranks[r][n].id] = blockId;
            blockWidths[blockId] = ranks[r][n].layoutNode.width;
            blockId++;
        }
        for (let n = 1; n < ranks[r].length; ++n) {
            const edgeLength = (ranks[r][n - 1].layoutNode.width + ranks[r][n].width) / 2 + this._options["targetEdgeLength"];
            blockGraph.addEdge(new Edge(blockPerNode[ranks[r][n - 1].id], blockPerNode[ranks[r][n].id], edgeLength));
        }

        for (let r = firstRank; r - verticalDir !== lastRank; r += verticalDir) {
            // create sorted list of neighbors
            const neighbors: Array<Array<number>> = new Array(ranks[r].length);
            const neighborsUsable: Array<Array<boolean>> = new Array(ranks[r].length);
            _.forEach(ranks[r], (node: LevelNode, n) => {
                neighbors[n] = [];
                neighborsUsable[n] = [];
            });
            console.log("ranks[" + r + "] = ", _.cloneDeep(ranks[r]));
            _.forEach(ranks[r - verticalDir], (neighbor: LevelNode, n) => {
                _.forEach(levelGraph[neighborOutMethod](neighbor.id), (edge: Edge<any, any>) => {
                    const node = levelGraph.node(edge[neighborEdgeInAttr]);
                    neighbors[node.position].push(n);
                });
            });

            // mark segments that cross a heavy segment as non-usable
            let heavyRightMaxPos = -1;
            let heavyLeftMaxPos = -1;
            let northPointer = 0;
            const neighborN = ranks[r - verticalDir].length;
            for (let n = 0; n < ranks[r].length; ++n) {
                while (northPointer < n && northPointer < neighborN) {
                    _.forEach(levelGraph[neighborOutMethod](ranks[r - verticalDir][northPointer++].id), edge => {
                        if (edge.weight === Number.POSITIVE_INFINITY) {
                            heavyRightMaxPos = Math.max(heavyRightMaxPos, levelGraph.node(edge[neighborEdgeInAttr]).position);
                        }
                    });
                }
                _.forEach(neighbors[n], (neighborPos: number, neighborIndex: number) => {
                    neighborsUsable[n][neighborIndex] = (n >= heavyRightMaxPos && neighborPos >= heavyLeftMaxPos);
                });
                _.forEach(levelGraph[neighborInMethod](ranks[r][n].id), edge => {
                    if (edge.weight === Number.POSITIVE_INFINITY) {
                        heavyLeftMaxPos = Math.max(heavyLeftMaxPos, levelGraph.node(edge[neighborEdgeOutAttr]).position);
                    }
                });
            }

            let maxNeighborTaken = (preference === "LEFT" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
            const compare = (preference === "LEFT" ? ((a, b) => a < b) : ((a, b) => a > b));
            const nMin = (preference === "LEFT" ? 0 : ranks[r].length - 1);
            const nMax = (preference === "LEFT" ? ranks[r].length - 1 : 0);
            const horizontalDir = (preference === "LEFT" ? 1 : -1);
            for (let n = nMin; n - horizontalDir !== nMax; n += horizontalDir) {
                let neighbor = null;
                if (neighbors[n].length > 0) {
                    const leftMedian = Math.floor((neighbors[n].length - 1) / 2);
                    const rightMedian = Math.floor((neighbors[n].length) / 2);
                    const tryOrder = (preference === "LEFT" ? [leftMedian, rightMedian] : [rightMedian, leftMedian]);
                    _.forEach(tryOrder, (neighborIndex: number) => {
                        if (neighbor !== null) {
                            return; // already found
                        }
                        if (neighborsUsable[n][neighborIndex] && compare(maxNeighborTaken, neighbors[n][neighborIndex])) {
                            neighbor = ranks[r - verticalDir][neighbors[n][neighborIndex]];
                            maxNeighborTaken = neighbors[n][neighborIndex];
                        }
                    });
                }
                if (neighbor === null) {
                    blockGraph.addNode(new RankNode(blockId.toString()));
                    blockPerNode[ranks[r][n].id] = blockId;
                    blockWidths[blockId] = ranks[r][n].layoutNode.width;
                    blockId++;
                } else {
                    const blockId = blockPerNode[neighbor.id];
                    blockPerNode[ranks[r][n].id] = blockId;
                    blockWidths[blockId] = Math.max(blockWidths[blockId], ranks[r][n].layoutNode.width);
                }
            }
            for (let n = 1; n < ranks[r].length; ++n) {
                const edgeLength = (ranks[r][n - 1].layoutNode.width + ranks[r][n].layoutNode.width) / 2 + this._options["targetEdgeLength"];
                blockGraph.addEdge(new Edge(blockPerNode[ranks[r][n - 1].id], blockPerNode[ranks[r][n].id], edgeLength));
            }
        }

        // compact
        blockGraph.rank();
        _.forEach(levelGraph.nodes(), (node: LevelNode) => {
            node.x = blockGraph.node(blockPerNode[node.id]).rank;
        });
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

    private _placeConnectors(node: LayoutNode, rankTops: Array<number>, rankBottoms: Array<number>) {
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

        // place bundles
        _.forEach(node.inConnectorBundles, (inBundle: LayoutBundle) => {
            inBundle.x = _.mean(_.map(inBundle.connectors, (name: string) => node.connector("IN", name).x));
            const top = rankTops[node.rank];
            inBundle.y = Math.min(top, node.y - this._options["targetEdgeLength"] / 2);
        });
        _.forEach(node.outConnectorBundles, (outBundle: LayoutBundle) => {
            outBundle.x = _.mean(_.map(outBundle.connectors, (name: string) => node.connector("OUT", name).x));
            const bottom = rankBottoms[node.rank + node.rankSpan - 1];
            outBundle.y = Math.max(bottom, node.y + node.height + this._options["targetEdgeLength"] / 2);
        });
    }
}
