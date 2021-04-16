import * as _ from "lodash";
import Assert from "../util/assert";
import Component from "../graph/component";
import Edge from "../graph/edge";
import Graph from "../graph/graph";
import OrderGroup from "./orderGroup";
import OrderNode from "./orderNode";
import OrderRank from "./orderRank";
import Timer from "../util/timer";

export default class OrderGraph {
    private _rankGraph: Graph<OrderRank, Edge<any, any>>;
    private _groupGraph: Graph<OrderGroup, Edge<any, any>>;
    private _nodeGraph: Graph<OrderNode, Edge<any, any>>;

    private _groupEdgesAdded: boolean = false;

    constructor() {
        this._rankGraph = new Graph<OrderRank, Edge<any, any>>();
        this._groupGraph = new Graph<OrderGroup, Edge<any, any>>();
        this._nodeGraph = new Graph<OrderNode, Edge<any, any>>();
    }

    toString(): string {
        const obj = {
            nodes: {},
            edges: [],
        };
        _.forEach(_.sortBy(this.groups(), "position"), (group: OrderGroup) => {
            obj.nodes[group.id] = {
                label: group.label(),
                child: {
                    nodes: {},
                    edges: [],
                },
            };
            _.forEach(group.orderedNodes(), (node: OrderNode) => {
                obj.nodes[group.id].child.nodes[node.id] = {
                    label: node.label(),
                    child: null
                };
            });
        });
        _.forEach(this.groupEdges(), (edge: Edge<any, any>) => {
            obj.edges.push({src: edge.src, dst: edge.dst, weight: edge.weight});
        });
        return JSON.stringify(obj);
    }

    storeLocal() {
        if (typeof window !== "undefined") {
            window.localStorage.setItem("storedGraph", this.toString());
        }
    }

    public addRank(rank: OrderRank, id: number = null) {
        rank.orderGraph = this;
        return this._rankGraph.addNode(rank, id);
    }

    public addGroup(group: OrderGroup, id: number = null) {
        return this._groupGraph.addNode(group, id);
    }

    public addNode(node: OrderNode, id: number = null): number {
        return this._nodeGraph.addNode(node, id);
    }

    public removeNode(id: number) {
        this._nodeGraph.removeNode(id);
    }

    public addEdge(edge: Edge<any, any>, id: number = null): number {
        return this._nodeGraph.addEdge(edge, id);
    }

    public removeEdge(id: number) {
        this._nodeGraph.removeEdge(id);
    }

    private _addGroupEdges() {
        if (!this._groupEdgesAdded) {
            this._groupEdgesAdded = true;
            _.forEach(this._nodeGraph.edges(), (edge: Edge<any, any>) => {
                const srcGroupId = this._nodeGraph.node(edge.src).group.id;
                const dstGroupId = this._nodeGraph.node(edge.dst).group.id;
                const groupEdge = this._groupGraph.edgeBetween(srcGroupId, dstGroupId);
                if (groupEdge === undefined) {
                    this._groupGraph.addEdge(new Edge(srcGroupId, dstGroupId, edge.weight));
                } else {
                    groupEdge.weight += edge.weight;
                }
            });
        }
    }

    private _addRankEdges() {
        _.forEach(this._groupGraph.edges(), (edge: Edge<any, any>) => {
            const srcRankId = this._groupGraph.node(edge.src).rank.id;
            const dstRankId = this._groupGraph.node(edge.dst).rank.id;
            if (!this._rankGraph.hasEdge(srcRankId, dstRankId)) {
                this._rankGraph.addEdge(new Edge(srcRankId, dstRankId));
            }
        });
    }

    public node(id: number) {
        return this._nodeGraph.node(id);
    }

    public group(id: number) {
        return this._groupGraph.node(id);
    }

    public nodes() {
        return this._nodeGraph.nodes();
    }

    public groups() {
        return this._groupGraph.nodes();
    }

    public ranks() {
        return this._rankGraph.toposort();
    }

    public edges() {
        return this._nodeGraph.edges();
    }

    public inEdges(id: number) {
        return this._nodeGraph.inEdges(id);
    }

    public outEdges(id: number) {
        return this._nodeGraph.outEdges(id);
    }

    public edgeBetween(srcId: number, dstId: number) {
        return this._nodeGraph.edgeBetween(srcId, dstId);
    }

    public maxId() {
        return this._nodeGraph.maxId();
    }

    public groupEdges() {
        this._addGroupEdges();
        return this._groupGraph.edges();
    }

    public order(doNothing: boolean = false, debug: boolean = false): void {
        const doOrder = (graph: OrderGraph, downward: boolean = true) => {
            Timer.start("doOrder")
            const ranks = graph._rankGraph.toposort();
            const groupOffsets = []; // number of nodes in groups left of this group by group id
            const numNodesGroup = []; // number of nodes per group per rank
            const numNodesRank = []; // total number of nodes per rank
            _.forEach(ranks, (rank: OrderRank, r: number) => {
                rank.order = _.sortBy(_.range(rank.groups.length), g => rank.groups[g].position);
                let groupOffset = 0;
                numNodesGroup[r] = [];
                _.forEach(rank.orderedGroups(), (group: OrderGroup, g) => {
                    groupOffsets[group.id] = groupOffset;
                    groupOffset += group.nodes.length;
                    numNodesGroup[r][g] = group.nodes.length;
                });
                numNodesRank[r] = groupOffset;
            });

            const nodeIndexes = []; // index of node within group by node id
            _.forEach(graph._groupGraph.nodes(), (group: OrderGroup) => {
                _.forEach(group.nodes, (node: OrderNode, nodeIndex) => {
                    nodeIndexes[node.id] = groupOffsets[group.id] + nodeIndex;
                });
            });
            const groupOffset = []; // number of nodes in groups left of this group by rank
            const neighborsDown = [];
            const weightsDown = [];
            const neighborsUp = [];
            const weightsUp = [];
            let order = []; // current order of this level (e. g. 2, 0, 1)
            let positions = []; // inverse of order (e. g. 1, 2, 0)
            const crossings = []; // number of crossings above each rank
            // set neighbors
            _.forEach(ranks, (rank: OrderRank, r: number) => {
                groupOffset[r] = [];
                neighborsDown[r] = [];
                weightsDown[r] = [];
                neighborsUp[r] = [];
                weightsUp[r] = [];
                order[r] = new Array(numNodesRank[r]);
                positions[r] = new Array(numNodesRank[r]);
                crossings[r] = Number.POSITIVE_INFINITY;
                _.forEach(rank.orderedGroups(), (group: OrderGroup, g: number) => {
                    groupOffset[r][g] = groupOffsets[group.id];
                    const groupOrder = _.range(groupOffset[r][g], groupOffset[r][g] + numNodesGroup[r][g]);
                    for (let n = 0; n < numNodesGroup[r][g]; ++n) {
                        order[r][groupOffset[r][g] + n] = groupOrder[n];
                    }
                    _.forEach(group.nodes, (node: OrderNode, n: number) => {
                        node.initialRank = r;
                        node.rank = r;
                        const pos = groupOffsets[group.id] + n;
                        neighborsDown[r][pos] = [];
                        weightsDown[r][pos] = [];
                        neighborsUp[r][pos] = [];
                        weightsUp[r][pos] =  [];
                        _.forEach(graph._nodeGraph.outEdges(node.id), (edge: Edge<any, any>) => {
                            neighborsDown[r][pos].push(nodeIndexes[edge.dst]);
                            weightsDown[r][pos].push(edge.weight);
                        });
                        _.forEach(graph._nodeGraph.inEdges(node.id), (edge: Edge<any, any>) => {
                            neighborsUp[r][pos].push(nodeIndexes[edge.src]);
                            weightsUp[r][pos].push(edge.weight);
                        });
                    });
                });
                _.forEach(order[r], (node, pos) => {
                    positions[r][node] = pos;
                });
                Assert.assertNone(positions[r], (pos, p) => order[r][pos] !== p, "positions and orders do not match after init " + positions[r].toString() + " | " + order[r].toString());
                Assert.assertNone(order[r], (ord, o) => positions[r][ord] !== o, "positions and orders do not match after init " + positions[r].toString() + " | " + order[r].toString());
            });

            crossings[0] = 0;

            const countCrossings = (testOrder: Array<number>, r: number, direction: "UP" | "DOWN") => {
                const edges = [];
                const neighbors = (direction === "UP" ? neighborsUp : neighborsDown);
                const weights = (direction === "UP" ? weightsUp : weightsDown);
                const neighborRank = (direction === "UP" ? (r - 1) : (r + 1));
                for (let pos = 0; pos < testOrder.length; ++pos) {
                    if ( neighbors[r][testOrder[pos]] === undefined) {
                        console.log("neighbors[" + r + "] = ", neighbors[r], "testOrder[" + pos + "] = ", testOrder[pos]);
                    }
                    for (let neighbor = 0; neighbor < neighbors[r][testOrder[pos]].length; ++neighbor) {
                        let weight = weights[r][testOrder[pos]][neighbor];
                        if (weight === Number.POSITIVE_INFINITY) {
                            weight = 1000000;
                        }
                        edges.push([
                            pos,
                            positions[neighborRank][neighbors[r][testOrder[pos]][neighbor]],
                            weight,
                        ]);
                    }
                }
                return this._countCrossings(testOrder.length, order[neighborRank].length, edges);
            };

            /**
             * Sweeps the ranks up and down and reorders the nodes according to the barycenter heuristic
             * @param countInitial
             */
            const reorder = (countInitial: boolean = false) => {
                Timer.start("reorder");
                // count initial crossings
                if (countInitial) {
                    for (let r = 1; r < ranks.length; ++r) {
                        crossings[r] = countCrossings(order[r], r, "UP");
                    }
                }

                let improveCounter = (!doNothing && (ranks.length > 1)) ? 2 : 0; // if only one rank, nothing to order
                while (improveCounter > 0) {
                    improveCounter--;
                    if (debug) {
                        console.log("TOTAL CROSSINGS", _.sum(crossings));
                    }
                    let firstRank = downward ? 1 : ranks.length - 2;
                    let lastRank = downward ? ranks.length - 1 : 0;
                    const direction = downward ? 1 : -1;
                    const neighborsNorth = downward ? neighborsUp : neighborsDown;
                    const crossingOffsetNorth = downward ? 0 : 1;
                    const crossingOffsetSouth = downward ? 1 : 0;
                    const northDirection = downward ? "UP" : "DOWN";
                    const southDirection = downward ? "DOWN" : "UP";
                    if (debug) {
                        console.log(downward ? "DOWN" : "UP");
                    }
                    for (let r = firstRank; r - direction !== lastRank; r += direction) {
                        Assert.assertNone(positions[r], (pos, p) => order[r][pos] !== p, "positions and orders do not match before reorder" + positions[r].toString() + order[r].toString());
                        Assert.assertNone(order[r], (ord, o) => positions[r][ord] !== o, "positions and orders do not match before reorder" + positions[r].toString() + order[r].toString());
                        if (debug) {
                            console.log("rank", r);
                        }
                        const newOrder = new Array(order[r].length);
                        const northRank = r - direction;

                        const prevCrossingsNorth = crossings[r + crossingOffsetNorth];

                        if (prevCrossingsNorth === 0) {
                            // no need to reorder
                            if (debug) {
                                console.log("skip because already 0");
                            }
                            continue;
                        }

                        for (let g = 0; g < numNodesGroup[r].length; ++g) {
                            // calculate mean position of neighbors
                            const nodeMeans = [];
                            for (let pos = groupOffset[r][g]; pos < groupOffset[r][g] + numNodesGroup[r][g]; ++pos) {
                                let sum = 0;
                                for (let neighbor = 0; neighbor < neighborsNorth[r][pos].length; ++neighbor) {
                                    sum += positions[northRank][neighborsNorth[r][pos][neighbor]];
                                }
                                if (neighborsNorth[r][pos].length > 0) {
                                    nodeMeans.push([pos, sum / neighborsNorth[r][pos].length]);
                                } else {
                                    nodeMeans.push([pos, pos]);
                                }
                            }

                            // sort by the means
                            const newGroupOrder = _.map(_.sortBy(nodeMeans, pair => pair[1]), pair => pair[0]);
                            for (let n = 0; n < numNodesGroup[r][g]; ++n) {
                                newOrder[groupOffset[r][g] + n] = newGroupOrder[n];
                            }
                        }
                        if (!_.isEqual(newOrder, order[r])) {
                            if (debug) {
                                console.log("try new order", _.cloneDeep(newOrder));
                            }
                            // count crossings with new order
                            const newCrossingsNorth = countCrossings(newOrder, r, northDirection);

                            let newCrossingsSouth = 0;
                            let prevCrossingsSouth = 0;
                            if (r !== lastRank) {
                                prevCrossingsSouth = crossings[r + crossingOffsetSouth];
                                newCrossingsSouth = countCrossings(newOrder, r, southDirection);
                            }
                            const fewerCrossingsNorth = newCrossingsNorth < prevCrossingsNorth;
                            const fewerOrEqualCrossingsTotal = (newCrossingsNorth + newCrossingsSouth <= prevCrossingsNorth + prevCrossingsSouth);
                            if (fewerCrossingsNorth && fewerOrEqualCrossingsTotal) {
                                if (debug) {
                                    console.log("fewer crossings", newCrossingsNorth, prevCrossingsNorth, newCrossingsSouth, prevCrossingsSouth);
                                }
                                if (newCrossingsNorth + newCrossingsSouth < prevCrossingsNorth + prevCrossingsSouth) {
                                    improveCounter = 2;
                                }
                                crossings[r + crossingOffsetNorth] = newCrossingsNorth;
                                if (r !== lastRank) {
                                    crossings[r + crossingOffsetSouth] = newCrossingsSouth;
                                }
                                order[r] = newOrder;
                                for (let pos = 0; pos < order[r].length; ++pos) {
                                    positions[r][order[r][pos]] = pos;
                                }
                            } else {
                                if (debug) {
                                    console.log("not fewer crossings", newCrossingsNorth, prevCrossingsNorth, newCrossingsSouth, prevCrossingsSouth);
                                }
                            }
                        } else {
                            if (debug) {
                                console.log("same order");
                            }
                        }
                        Assert.assertNone(positions[r], (pos, p) => order[r][pos] !== p, "positions and orders do not match after reorder" + positions[r].toString() + order[r].toString());
                        Assert.assertNone(order[r], (ord, o) => positions[r][ord] !== o, "positions and orders do not match after reorder" + positions[r].toString() + order[r].toString());
                    }
                    downward = !downward;
                }

                for (let r = 1; r < ranks.length; ++r) {
                    crossings[r] = countCrossings(order[r], r, "UP");
                }

                Timer.stop("reorder");
            };

            const assertNeighborCoherence = (r: number = null) => {
                if (r === null) {
                    _.forEach(_.range(ranks.length), r => assertNeighborCoherence(r));
                    return;
                }
                _.forEach(neighborsDown[r], (neighborsPerNode, n) => {
                    Assert.assertAll(neighborsPerNode, neighbor => neighborsUp[r + 1][neighbor].indexOf(n) !== -1, "neighbor in rank " + (r + 1) + " is missing upNeighbor");
                });
                _.forEach(neighborsUp[r], (neighborsPerNode, n) => {
                    Assert.assertAll(neighborsPerNode, neighbor => neighborsDown[r - 1][neighbor].indexOf(n) !== -1, "neighbor in rank " + (r - 1) + "is missing downNeighbor");
                });
            }

            const assertOrderAndPositionCoherence = (r: number = null) => {
                if (r === null) {
                    _.forEach(_.range(ranks.length), r => assertOrderAndPositionCoherence(r));
                }
                Assert.assertEqual(_.sortBy(order[r]), _.range(0, order[r].length), "order in rank " + r + " not contiguous");
                Assert.assertEqual(_.sortBy(positions[r]), _.range(0, order[r].length), "positions in rank " + r + " not contiguous");
                Assert.assertNone(positions[r], (pos, p) => order[r][pos] !== p, "positions and orders do not match");
                Assert.assertNone(order[r], (ord, o) => positions[r][ord] !== o, "positions and orders do not match");
            }

            const assertEdgesBetweenNeighboringRanks = () => {
                Assert.assertAll(this.edges(), edge => {
                    return this.node(edge.src).rank + 1 === this.node(edge.dst).rank;
                }, "edge not between neighboring ranks");
            }

            const getIllegalCrossing = () => {
                for (let r = 1; r < ranks.length; ++r) {
                    if (crossings[r] >= 1000000) {
                        // there is at least one illegal crossing between this and the upper rank
                        const segmentStarts = [];
                        const segmentEnds = [];
                        for (let n = 0; n < Math.max(order[r - 1].length); ++n) {
                            segmentStarts[n] = [];
                        }
                        for (let n = 0; n < Math.max(order[r].length); ++n) {
                            segmentEnds[n] = [];
                        }
                        for (let n = 0; n < order[r].length; ++n) {
                            const posSouth = positions[r][n];
                            for (let neighbor = 0; neighbor < neighborsUp[r][n].length; ++neighbor) {
                                const posNorth = positions[r - 1][neighborsUp[r][n][neighbor]];
                                const heavy = (weightsUp[r][n][neighbor] === Number.POSITIVE_INFINITY);
                                const segment = [posNorth, posSouth, heavy];
                                segmentStarts[posNorth].push(segment);
                                segmentEnds[posSouth].push(segment);
                            }
                        }
                        const openSegments: Set<[number, number, boolean]> = new Set();
                        for (let n = 0; n < Math.max(order[r].length, order[r - 1].length); ++n) {
                            _.forEach(segmentStarts[n], (segment: [number, number, boolean]) => {
                                const [posNorth, posSouth, heavy] = segment;
                                if (posNorth >= posSouth) {
                                    openSegments.delete(segment);
                                }
                            });
                            _.forEach(segmentEnds[n], (segment: [number, number, boolean]) => {
                                const [posNorth, posSouth, heavy] = segment;
                                if (posNorth < posSouth) { // equality handled in loop above
                                    openSegments.delete(segment);
                                }
                            });
                            const newSegments = [];
                            _.forEach(segmentStarts[n], (segment: [number, number, boolean]) => {
                                const [posNorth, posSouth, heavy] = segment;
                                if (posNorth <= posSouth) {
                                    newSegments.push(segment);
                                }
                            });
                            _.forEach(segmentEnds[n], (segment: [number, number, boolean]) => {
                                const [posNorth, posSouth, heavy] = segment;
                                if (posNorth > posSouth) { // equality handled in loop above
                                    newSegments.push(segment);
                                }
                            });
                            for (let newSegment of newSegments) {
                                const [posNorth, posSouth, heavy] = newSegment;
                                let newDir = Math.sign(posSouth - posNorth);
                                for (let openSegment of openSegments) {
                                    const [openPosNorth, openPosSouth, openHeavy] = openSegment;
                                    // dir is
                                    let openDir = Math.sign(openPosSouth - openPosNorth);
                                    if ((newDir !== openDir) || (newDir === 1 && posSouth < openPosSouth) || (posNorth < openPosNorth)) {
                                        // segments have different direction or new segment is more vertical
                                        if (openHeavy) {
                                            return [r, openPosNorth, openPosSouth, posNorth, posSouth];
                                        } else if (heavy) {
                                            return [r, posNorth, posSouth, openPosNorth, openPosSouth];
                                        }
                                    }
                                }
                                if (newDir !== 0) {
                                    openSegments.add(newSegment);
                                }
                            }
                        }
                    }
                }
                return null;
            }

            let step = 0;

            const storeLocal = () => {
                if (typeof window === "undefined") {
                    return;
                }
                step++;
                if (step === 1) {
                    const obj = [];
                    window.localStorage.setItem("orderGraph", JSON.stringify(obj));
                }
                if (step < 1000) {
                    //return;
                }
                const obj = JSON.parse(window.localStorage.getItem("orderGraph"));
                _.forEach(ranks, (rank: OrderRank, r: number) => {
                    _.forEach(rank.orderedGroups(), (group: OrderGroup, g: number) => {
                        group.order = _.map(_.slice(order[r], groupOffset[r][g], groupOffset[r][g] + numNodesGroup[r][g]),
                            (pos: number) => pos - groupOffset[r][g]
                        );
                        _.forEach(group.nodes, (node: OrderNode, n: number) => {
                            node.position = positions[r][groupOffset[r][g] + n] - groupOffset[r][g];
                        });
                    });
                });
                const stepObj = {ranks: [], edges: []};
                _.forEach(ranks, (rank: OrderRank) => {
                    const rankObj = [];
                    _.forEach(rank.orderedGroups(), (group: OrderGroup) => {
                        const groupObj = {label: group.label(), nodes: []};
                        _.forEach(group.orderedNodes(), (node: OrderNode) => {
                            groupObj.nodes.push({id: node.id, label: node.label()});
                        });
                        rankObj.push(groupObj);
                    });
                    stepObj.ranks.push(rankObj);
                });
                _.forEach(graph.edges(), edge => {
                    stepObj.edges.push({src: edge.src, dst: edge.dst, weight: edge.weight === Number.POSITIVE_INFINITY ? "INFINITY" : edge.weight});
                });
                obj.push(stepObj);
                window.localStorage.setItem("orderGraph", JSON.stringify(obj));
            };

            /**
             * Tries to resolve illegal crossings, i. e. crossings of edges with infinite weight.
             */
            const resolve = () => {
                Timer.start("resolve");
                const resolveCrossing = (crossing) => {
                    const [r, heavyNorth, heavySouth, otherNorth, otherSouth] = crossing;
                    Assert.assert(groupOffset[r].length === 1, "more than one group");
                    Assert.assert(groupOffset[r - 1].length === 1, "more than one group");
                    const heavyNorthN = order[r - 1][heavyNorth];
                    const heavyNorthNode = ranks[r - 1].groups[0].nodes[heavyNorthN];
                    const heavySouthN = order[r][heavySouth];
                    const heavySouthNode = ranks[r].groups[0].nodes[heavySouthN];
                    const otherNorthN = order[r - 1][otherNorth];
                    let otherNorthNode = ranks[r - 1].groups[0].nodes[otherNorthN];
                    const otherSouthN = order[r][otherSouth];
                    let otherSouthNode = ranks[r].groups[0].nodes[otherSouthN];
                    const otherEdge = graph.edgeBetween(otherNorthNode.id, otherSouthNode.id);

                    const resolveY = () => {
                        console.log("resolveY");
                        let heavyPerRank: Map<number, number> = new Map([[r - 1, heavyNorth]]);
                        _.forEach([1], direction => {
                            const neighbors = (direction === 1 ? neighborsDown : neighborsUp);
                            const weights = (direction === 1 ? weightsDown : weightsUp);
                            let heavyPos = (direction === 1 ? heavyNorth : heavySouth);
                            let tmpR = (direction === 1 ? r - 1 : r);
                            while (neighbors[tmpR][order[tmpR][heavyPos]].length > 0 && weights[tmpR][order[tmpR][heavyPos]][0] === Number.POSITIVE_INFINITY) {
                                heavyPos = positions[tmpR + direction][neighbors[tmpR][order[tmpR][heavyPos]][0]];
                                heavyPerRank.set(tmpR + direction, heavyPos);
                                tmpR += direction;
                            }
                        });

                        let heavyBottomR = 0;
                        heavyPerRank.forEach((pos, r) => {
                            heavyBottomR = Math.max(heavyBottomR, r);
                        });

                        const addEdge = (srcNode: OrderNode, dstNode: OrderNode, weight: number) => {
                            if (srcNode.isVirtual && dstNode.isVirtual) {
                                weight = Number.POSITIVE_INFINITY;
                            }
                            const newEdge = new Edge(srcNode.id, dstNode.id, weight);
                            const newEdgeId = this.addEdge(newEdge);
                            graph.addEdge(newEdge, newEdgeId);
                            Assert.assert(srcNode.rank + 1 === dstNode.rank, "edge not between neighboring ranks", srcNode, dstNode);
                        };

                        const removeEdge = (srcNode: OrderNode, dstNode: OrderNode) => {
                            const edge = graph.edgeBetween(srcNode.id, dstNode.id);
                            graph.removeEdge(edge.id);
                            this.removeEdge(edge.id);
                        };

                        const addNode = (r: number, pos: number, node: OrderNode, nodeId: number) => {
                            const nextN = numNodesGroup[r][0];
                            // console.log("add node", node, "with n", nextN, "at position", pos, "in rank", r);
                            for (let tmpPos = numNodesGroup[r][0]; tmpPos >= pos + 1; --tmpPos) {
                                order[r][tmpPos] = order[r][tmpPos - 1];
                                //console.log("node", ranks[r].groups[0].nodes[order[r][tmpPos]], "moves from position", tmpPos - 1, "to", tmpPos);
                            }
                            order[r][pos] = nextN;
                            ranks[r].groups[0].addNode(node, nodeId);
                            numNodesGroup[r][0]++;
                            node.rank = r;
                            node.index = nextN;
                            // update positions
                            _.forEach(order[r], (n, pos) => {
                                positions[r][n] = pos;
                            });

                            assertOrderAndPositionCoherence(r);

                            return nextN;
                        };

                        const removeNode = (r: number, pos: number, node: OrderNode) => {
                            const n = order[r][pos];
                            //console.log("remove node", node, "with n", n, "from position", pos, "in rank", r);

                            // adjust n's
                            for (let tmpN = n + 1; tmpN < numNodesGroup[r][0]; ++tmpN) {
                                order[r][positions[r][tmpN]]--;
                                //console.log("node", ranks[r].groups[0].nodes[tmpN], "changes index from", ranks[r].groups[0].nodes[tmpN].index + 1, "to", ranks[r].groups[0].nodes[tmpN].index);
                            }
                            ranks[r].groups[0].removeNode(node);

                            // adjust positions
                            for (let tmpPos = pos + 1; tmpPos < numNodesGroup[r][0]; ++tmpPos) {
                                order[r][tmpPos - 1] = order[r][tmpPos];
                                //console.log("node", ranks[r].groups[0].nodes[order[r][tmpPos]], "moves from position", tmpPos, "to", tmpPos - 1);
                            }

                            numNodesGroup[r][0]--;
                            order[r].length = numNodesGroup[r][0];
                            positions[r].length = numNodesGroup[r][0];

                            // update positions
                            _.forEach(order[r], (n, pos) => {
                                positions[r][n] = pos;
                            });

                            assertOrderAndPositionCoherence(r);
                        };

                        // remove "other" edge
                        const otherNorthN = order[r - 1][otherNorth];
                        let otherNorthNode = ranks[r - 1].groups[0].nodes[otherNorthN];
                        const otherSouthN = order[r][otherSouth];
                        let otherSouthNode = ranks[r].groups[0].nodes[otherSouthN];
                        const otherEdge = graph.edgeBetween(otherNorthNode.id, otherSouthNode.id);
                        const otherEdgeWeight = otherEdge.weight;
                        removeEdge(otherNorthNode, otherSouthNode);

                        const northParents = new Map();
                        _.forEach(graph.inEdges(otherNorthNode.id), inEdge => {
                            northParents.set(graph.node(inEdge.src), inEdge.weight);
                        });
                        const rOffset = r - 1;
                        const queue: Array<Map<OrderNode, [Map<OrderNode, number>, number, boolean]>> = [
                            new Map([[otherNorthNode, [northParents, heavyBottomR - r + 1, true]]]), // 0 => r - 1
                            new Map([[otherSouthNode, [new Map(), heavyBottomR - r + 1, false]]]), // 1 => r
                        ];

                        if (debug) {
                            storeLocal();
                        }

                        for (let tmpR = 0; tmpR < queue.length; ++tmpR) {
                            const r = tmpR + rOffset;
                            //console.log("MOVE RANK", r, _.cloneDeep(queue[tmpR]));
                            for (let [node, data] of queue[tmpR]) {
                                queue[tmpR].delete(node);
                                const n = node.index;
                                const pos = positions[r][n];
                                const [parents, downForce, isNorth] = data;

                                //console.log("move node", node, "with n", n, "pos", pos, "parents", parents, "downForce", downForce, "isNorth", isNorth);

                                // create rank below if necessary
                                if (r === order.length - 1) {
                                    const newRank = new OrderRank();
                                    this.addRank(newRank);
                                    const newGroup = new OrderGroup(null);
                                    newRank.addGroup(newGroup);
                                    const newRankComponent = new OrderRank();
                                    graph.addRank(newRankComponent);
                                    ranks.push(newRankComponent);
                                    newRankComponent.addGroup(newGroup);
                                    this._groupGraph.addEdge(new Edge(ranks[r].groups[0].id, ranks[r + 1].groups[0].id));
                                    this._rankGraph.addEdge(new Edge(ranks[r].id, ranks[r + 1].id));
                                    newRankComponent.order = [0];
                                    numNodesGroup[r + 1] = [0];
                                    groupOffset[r + 1] = [0];
                                    order[r + 1] = [];
                                    positions[r + 1] = [];
                                    crossings[r + 1] = 0;
                                }

                                let nextPos;
                                const nonParentInEdges = [];

                                if (!node.isVirtual) {
                                    // move node to rank below
                                    removeNode(r, pos, node);

                                    if (heavyPerRank.get(r + 1) !== undefined) {
                                        const posRelToHeavy = (heavyPerRank.get(r) - pos);
                                        nextPos = heavyPerRank.get(r + 1) - posRelToHeavy + (posRelToHeavy > 0 ? 1 : 0);
                                    } else {
                                        nextPos = pos;
                                    }
                                    nextPos = Math.max(Math.min(nextPos, numNodesGroup[r + 1][0]), 0);
                                    addNode(r + 1, nextPos, node, node.id);

                                    _.forEach(graph.inEdges(node.id), inEdge => {
                                        if (!parents.has(graph.node(inEdge.src))) {
                                            nonParentInEdges.push(inEdge);
                                        }
                                    });
                                } else {
                                    // remove in-edge
                                    _.forEach(graph.inEdges(node.id), inEdge => {
                                        removeEdge(graph.node(inEdge.src), node);
                                    });
                                }

                                // if node is part of the "other" node displacement, create new node in place of current node
                                // (only if node has in-edges)
                                let addOutNeighbors = true;
                                if (downForce > 0) {
                                    const nextParents: Map<OrderNode, number> = new Map();
                                    // "other north" node has all in-edges as parents
                                    // "other south" node has no parents, but may have non-parent in-edges
                                    if (!node.isVirtual) {
                                        if (parents.size > 0) {
                                            const newNode = new OrderNode(null, true, node.label() + "'");
                                            this.addNode(newNode);
                                            if (parents.size === 1 && parents.values().next().value === Number.POSITIVE_INFINITY && !parents.keys().next().value.isVirtual) {
                                                // SPECIAL CASE:
                                                // "other" edge is outgoing of a child graph
                                                // => we may not move the last node of the child graph down
                                                // instead we move it up again and insert the new virtual node below
                                                removeNode(r + 1, nextPos, node);
                                                addNode(r, pos, node, node.id);
                                                newNode.initialRank = r + 1;
                                                addNode(r + 1, nextPos, newNode, newNode.id);
                                                Assert.assert(nonParentInEdges.length === 0, "special case does not look as assumed");
                                                Assert.assert(node === otherNorthNode, "special case does not look as assumed");
                                                addEdge(node, newNode, otherEdgeWeight);
                                                // for each out edge add an extra virtual node
                                                _.forEach(graph.outEdges(node.id), outEdge => {
                                                    if (outEdge.dst !== newNode.id) {
                                                        removeEdge(node, graph.node(outEdge.dst));
                                                        const additionalNode = new OrderNode(null, true, graph.node(outEdge.dst).label() + "'");
                                                        this.addNode(additionalNode);
                                                        addNode(r + 1, nextPos, additionalNode, additionalNode.id);
                                                        addEdge(node, additionalNode, outEdge.weight);
                                                        addEdge(additionalNode, graph.node(outEdge.dst), outEdge.weight);
                                                        queue[tmpR + 1].set(graph.node(outEdge.dst), [new Map([[additionalNode, outEdge.weight]]), 0, false]);
                                                    }
                                                });
                                                otherNorthNode = newNode;
                                                nextParents.set(node, otherEdgeWeight);
                                                node = newNode;
                                            } else {
                                                // otherwise create virtual node above
                                                newNode.initialRank = r;
                                                addNode(r, pos, newNode, newNode.id);
                                                // route edges from parents through new node to original node
                                                parents.forEach((parentWeight: number, parentNode: OrderNode) => {
                                                    removeEdge(parentNode, node);
                                                    addEdge(parentNode, newNode, parentWeight);
                                                });
                                                addEdge(newNode, node, otherEdgeWeight);
                                            }
                                            nextParents.set(newNode, otherEdgeWeight);
                                        }
                                    } else {
                                        // node is virtual
                                        console.log("node is virtual");
                                        Assert.assert(nonParentInEdges.length === 0, "virtual node has non-parent in-edges");
                                        const outEdge = graph.outEdges(node.id)[0];
                                        nextParents.set(node, outEdge.weight);
                                        if (node === otherNorthNode) {
                                            otherNorthNode = graph.node(outEdge.dst);
                                        }
                                        if (node === otherSouthNode) {
                                            otherSouthNode = graph.node(outEdge.dst);
                                        }
                                        const nextNode = graph.node(outEdge.dst);
                                        // remove node and out-edge
                                        removeEdge(node, nextNode);
                                        removeNode(r, pos, node);
                                        graph.removeNode(node.id);
                                        this.removeNode(node.id);
                                        node = nextNode;
                                        addOutNeighbors = false;
                                    }
                                    if (downForce > 1) {
                                        // mark moved node to be moved again
                                        if (queue.length < tmpR + 2) {
                                            queue[tmpR + 1] = new Map();
                                        }
                                        queue[tmpR + 1].set(node, [nextParents, downForce - 1, isNorth]);
                                    }
                                }
                                // for all in-neighbors that are not parents, create new node in place of current node
                                // (only if node has in-edges)
                                _.forEach(nonParentInEdges, inEdge => {
                                    const inNeighbor = graph.node(inEdge.src);
                                    // if in-neighbor has no in-edges, move in-neighbor instead of creating a new virtual node
                                    if (graph.inEdges(inNeighbor.id).length === 0) {
                                        removeNode(r - 1, positions[r - 1][inNeighbor.index], inNeighbor);
                                        inNeighbor.rank = r;
                                        addNode(r, pos, inNeighbor, inNeighbor.id);
                                    } else {
                                        const newNode = new OrderNode(null, true, inNeighbor.label() + "'");
                                        newNode.initialRank = r;
                                        const newNodeId = this.addNode(newNode);
                                        addNode(r, pos, newNode, newNodeId);
                                        // route edge from in-neighbor through new node to original node
                                        removeEdge(inNeighbor, node);
                                        // add in-edge
                                        addEdge(inNeighbor, newNode, inEdge.weight);
                                        // add edge between new node and moved node
                                        addEdge(newNode, node, inEdge.weight);
                                    }
                                });
                                // mark out-neighbors as next to move
                                if (addOutNeighbors) {
                                    _.forEach(graph.outEdges(node.id), outEdge => {
                                        if (queue.length < tmpR + 2) {
                                            queue[tmpR + 1] = new Map();
                                        }
                                        const dstNode = graph.node(outEdge.dst);
                                        if (!queue[tmpR + 1].has(dstNode)) {
                                            queue[tmpR + 1].set(dstNode, [new Map([[node, outEdge.weight]]), 0, false]);
                                        } else {
                                            queue[tmpR + 1].get(dstNode)[0].set(node, outEdge.weight);
                                        }
                                    });
                                }
                                if (debug) {
                                    storeLocal();
                                }
                            }
                        }
                        // add "other" edge
                        addEdge(otherNorthNode, otherSouthNode, otherEdgeWeight);

                        if (debug) {
                            storeLocal();
                        }

                        // recreate neighbors data structure
                        for (let r = 0; r < ranks.length; ++r) {
                            neighborsDown[r] = [];
                            weightsDown[r] = [];
                            neighborsUp[r] = [];
                            weightsUp[r] = [];
                            _.forEach(ranks[r].groups[0].nodes, (node: OrderNode, n: number) => {
                                neighborsDown[r][n] = [];
                                weightsDown[r][n] = [];
                                neighborsUp[r][n] = [];
                                weightsUp[r][n] = [];
                            });
                        }
                        _.forEach(graph.edges(), edge => {
                            const srcNode = graph.node(edge.src);
                            const dstNode = graph.node(edge.dst);
                            Assert.assert(srcNode.rank + 1 === dstNode.rank, "edge not between neighboring ranks", srcNode, dstNode);
                            neighborsDown[srcNode.rank][srcNode.index].push(dstNode.index);
                            weightsDown[srcNode.rank][srcNode.index].push(edge.weight);
                            neighborsUp[dstNode.rank][dstNode.index].push(srcNode.index);
                            weightsUp[dstNode.rank][dstNode.index].push(edge.weight);
                        });

                        assertNeighborCoherence();

                        //reorder(true);
                    }

                    const checkXResolution = (side: "LEFT" | "RIGHT") => {
                        const nodesPerRank = new Array(ranks.length);
                        const minHeavyNodePerRank: Array<number> = new Array(ranks.length);
                        const maxOtherNodePerRank: Array<number> = new Array(ranks.length);
                        let conflict = false;
                        for (let r = 0; r < ranks.length; ++r) {
                            nodesPerRank[r] = new Map();
                            minHeavyNodePerRank[r] = (side === "RIGHT" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
                            maxOtherNodePerRank[r] = (side === "RIGHT" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
                        }
                        const queue: Array<[OrderNode, string]> = [];
                        let minRank = r - 1;
                        let maxRank = r;
                        const moveDir = (side === "LEFT" ? 1 : -1);
                        const minFun = (side === "RIGHT" ? Math.min : Math.max);
                        const maxFun = (side === "RIGHT" ? Math.max : Math.min);
                        const geFun = (side === "RIGHT" ? ((a, b) => a >= b) : ((a, b) => a <= b));
                        const addNodeToGroup = (r: number, node: OrderNode, group: string) => {
                            //if (side === "LEFT") console.log("node " + node.id + " now is in group " + group);
                            nodesPerRank[r].set(node, group);
                            queue.push([node, group]);
                            const addIntermediate = () => {
                                if (geFun(maxOtherNodePerRank[r], minHeavyNodePerRank[r])) {
                                    //if (side === "LEFT") console.log(maxOtherNodePerRank[r], "ge", minHeavyNodePerRank[r]);
                                    const intermediate = [];
                                    for (let pos = maxOtherNodePerRank[r]; pos !== minHeavyNodePerRank[r]; pos += moveDir) {
                                        const node = ranks[r].groups[0].nodes[order[r][pos]];
                                        if (node === undefined) {
                                            //console.log("undefined", "pos", pos, "nodes", ranks[r].groups[0].nodes, order[r][pos], "order", order[r], "moveDir", moveDir, "maxOtherNodePerRank[r]", maxOtherNodePerRank[r], "minHeavyNodePerRank[r]", minHeavyNodePerRank[r]);
                                        }
                                        if (!nodesPerRank[r].has(node)) {
                                            intermediate.push([node, "ANY"]);
                                        } else if (node.rank === minRank) {
                                            intermediate.push([node, nodesPerRank[r].get(node)]); // check boundaries again
                                        }
                                    }
                                    _.forEach(intermediate, ([node, group]) => {
                                        addNodeToGroup(r, node, group);
                                    });
                                }
                            }
                            if (group === "OTHER") {
                                const prev = maxOtherNodePerRank[r];
                                maxOtherNodePerRank[r] = maxFun(maxOtherNodePerRank[r], positions[r][node.index]);
                                if (maxOtherNodePerRank[r] !== prev) {
                                    //if (side === "LEFT") console.log("maxMovingNodePerRank[" + r + "] = ", maxOtherNodePerRank[r]);
                                }
                                if (maxOtherNodePerRank[r] !== prev && minHeavyNodePerRank[r] !== Number.POSITIVE_INFINITY && minHeavyNodePerRank[r] !== Number.NEGATIVE_INFINITY) {
                                    addIntermediate();
                                }
                            } else {
                                // potentially heavy
                                const prev = minHeavyNodePerRank[r];
                                minHeavyNodePerRank[r] = minFun(minHeavyNodePerRank[r], positions[r][node.index]);
                                if (minHeavyNodePerRank[r] !== prev) {
                                    //if (side === "LEFT") console.log("minHeavyNodePerRank[" + r + "] = ", minHeavyNodePerRank[r]);
                                }
                                if (minHeavyNodePerRank[r] !== prev && maxOtherNodePerRank[r] !== Number.POSITIVE_INFINITY && maxOtherNodePerRank[r] !== Number.NEGATIVE_INFINITY) {
                                    addIntermediate();
                                }
                            }
                        };
                        addNodeToGroup(r - 1, heavyNorthNode, "HEAVY");
                        addNodeToGroup(r, heavySouthNode, "HEAVY");
                        addNodeToGroup(r - 1, otherNorthNode, "OTHER");
                        addNodeToGroup(r, otherSouthNode, "OTHER");

                        let queuePointer = 0;
                        while (queuePointer < queue.length && !conflict) {
                            const [node, group] = queue[queuePointer++];
                            if (nodesPerRank[node.rank].get(node) !== group) {
                                continue; // group has changed in the meantime
                            }
                            const addNeighbors = (neighborMethod: "inEdges" | "outEdges", neighborProperty: "src" | "dst", rankOffset: 1 | -1) => {
                                _.forEach(graph[neighborMethod](node.id), edge => {
                                    if (edge === otherEdge) {
                                        return;
                                    }
                                    const neighborRank = node.rank + rankOffset;
                                    const neighbor = graph.node(edge[neighborProperty]);
                                    if (!nodesPerRank[neighborRank].has(neighbor)) {
                                        // add neighbor to same group as this node
                                        addNodeToGroup(neighborRank, neighbor, group);
                                    } else {
                                        // check for conflict or group change
                                        const neighborGroup = nodesPerRank[neighborRank].get(neighbor);
                                        if (neighborGroup !== group) {
                                            if (neighborGroup === "ANY") {
                                                addNodeToGroup(neighborRank, neighbor, group);
                                            } else if (group === "ANY") {
                                                addNodeToGroup(node.rank, node, neighborGroup);
                                            } else {
                                                // one is "HEAVY" and the other is "OTHER"
                                                conflict = true;
                                            }
                                        }
                                    }
                                });
                            };
                            //if (side === "LEFT") console.log("node", node.id, "minRank", minRank);
                            if (node.rank > minRank) {
                                addNeighbors("inEdges", "src", -1);
                            }
                            if (node.rank === minRank && geFun(positions[node.rank][node.index], minHeavyNodePerRank[node.rank])) {
                                let foundNewMinRank = false;
                                _.forEach(graph.inEdges(node.id), inEdge => {
                                    if (inEdge.weight === Number.POSITIVE_INFINITY) {
                                        foundNewMinRank = true;
                                    }
                                });
                                if (foundNewMinRank) {
                                    minRank--;
                                    nodesPerRank[node.rank].forEach((group, borderNode) => {
                                        queue.push([borderNode, group]);
                                    });
                                }
                            }
                            if (node.rank < maxRank) {
                                addNeighbors("outEdges", "dst", 1);
                            }
                        }
                        if (conflict) {
                            return null;
                        }
                        let minHeavyRank = Number.POSITIVE_INFINITY;
                        _.forEach(nodesPerRank, (nodes, r) => {
                            nodes.forEach(group => {
                                if (group === "HEAVY" || group === "ANY") {
                                    minHeavyRank = Math.min(minHeavyRank, r);
                                }
                            });
                        });
                        if (minHeavyRank > minRank) {
                            return null;
                        }
                        // group nodes
                        const nodesPerRankGrouped = [];
                        _.forEach(nodesPerRank, (nodes, r) => {
                            nodesPerRankGrouped[r] = {
                                "HEAVY": new Set(),
                                "MOVING": new Set(),
                            };
                            //if (side === "RIGHT") console.log("rank", r, "nodes", nodes);
                            minHeavyNodePerRank[r] = (side === "RIGHT" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
                            //if (side === "LEFT") console.log("rank", r, ":", _.map(order[r], n => ranks[r].groups[0].nodes[n].id).toString());
                            nodes.forEach((group, node) => {
                                if (group !== "OTHER") {
                                    // "HEAVY" or "ANY"
                                    // because we want to move as few nodes as possible, we count the "ANY" nodes to the "HEAVY" nodes
                                    nodesPerRankGrouped[r]["HEAVY"].add(node);
                                    //if (side === "LEFT") console.log("rank", r, "node", node.id, "group", group, "position", positions[r][node.index]);
                                    minHeavyNodePerRank[r] = minFun(minHeavyNodePerRank[r], positions[r][node.index]);
                                }
                            });
                            nodes.forEach((group, node) => {
                                if (group === "OTHER" && geFun(positions[r][node.index], minHeavyNodePerRank[node.rank])) {
                                    nodesPerRankGrouped[r]["MOVING"].add(node);
                                }
                            });
                        });
                        return nodesPerRankGrouped;
                    };

                    const resolveX = (side: "LEFT" | "RIGHT", nodesPerRank) => {
                        console.log("resolveX by moving nodes on the " + side.toLowerCase());
                        _.forEach(nodesPerRank, (rank, r) => {
                            if (rank["MOVING"].size === 0 || rank["HEAVY"].size === 0) {
                                return;
                            }
                            const heavy: Array<OrderNode> = _.sortBy(Array.from(rank["HEAVY"]), node => positions[r][node.index]);
                            const moving: Array<OrderNode> = _.sortBy(Array.from(rank["MOVING"]), node => positions[r][node.index]);
                            const newOrder = [];
                            _.forEach(order[r], n => {
                                const node = ranks[r].groups[0].nodes[n];
                                if (rank["MOVING"].has(node)) {
                                    return; // do nothing
                                }
                                if (side === "RIGHT" && n === heavy[0].index) {
                                    _.forEach(moving, movingNode => {
                                        newOrder.push(movingNode.index);
                                    });
                                }
                                newOrder.push(n);
                                if (side === "LEFT" && n === _.last(heavy).index) {
                                    _.forEach(moving, movingNode => {
                                        newOrder.push(movingNode.index);
                                    });
                                }
                            });
                            order[r] = newOrder;
                            _.forEach(order[r], (n, pos) => {
                                positions[r][n] = pos;
                            });
                        });
                        if (debug) {
                            storeLocal();
                        }
                    };

                    const leftResolution = checkXResolution("LEFT");
                    const rightResolution = checkXResolution("RIGHT");
                    console.log("leftResolution", leftResolution, "rightResolution", rightResolution);
                    /*if (leftResolution === null) {
                        if (rightResolution === null) {
                            resolveY();
                        } else {
                            resolveX("RIGHT", rightResolution);
                        }
                    } else {
                        if (rightResolution === null) {
                            resolveX("LEFT", leftResolution);
                        } else {
                            const numNodesLeft = _.sum(_.map(leftResolution, rank => rank["MOVING"].size));
                            const numNodesRight= _.sum(_.map(rightResolution, rank => rank["MOVING"].size));
                            if (numNodesLeft < numNodesRight) {
                                resolveX("LEFT", leftResolution);
                            } else {
                                resolveX("RIGHT", rightResolution);
                            }
                        }
                    }*/

                    resolveY();
                    doNothing = false;
                    //reorder(true);
                    if (debug) {
                        storeLocal();
                    }

                    for (let r = 1; r < ranks.length; ++r) {
                        crossings[r] = countCrossings(order[r], r, "UP");
                    }
                }

                if (debug) {
                    storeLocal();
                }

                let counter = 0;
                let invalid = false;
                let crossing = getIllegalCrossing();
                if (debug) {
                    console.log("illegal crossing", crossing);
                }
                while (crossing !== null) {
                    if (counter++ === 10) {
                        invalid = true;
                        break;
                    }
                    if (debug) {
                        console.log("resolve", _.sum(crossings));
                    }
                    resolveCrossing(crossing);
                    const prevCrossing = crossing;
                    crossing = getIllegalCrossing();
                    console.log("illegal crossing", crossing);
                    if (crossing !== null) {
                        //Assert.assert(crossing[0] >= prevCrossing[0], "created crossing in lower rank");
                    }
                }

                Timer.stop("resolve")
                return !invalid;
            }

            const originalOrder = _.cloneDeep(order);
            const originalPositions = _.cloneDeep(positions);

            doNothing = true;
            reorder(false);
            /*const success = resolveY();
            Assert.assert(success, "y resolution failed");*/
            if (!resolve()) {
                /*order = _.cloneDeep(originalOrder);
                positions = _.cloneDeep(originalPositions);
                reorder(true);
                const success = resolve();*/
                Assert.assert(false, "illegal crossings when starting from original order");
            }

            _.forEach(ranks, (rank: OrderRank, r: number) => {
                _.forEach(rank.orderedGroups(), (group: OrderGroup, g: number) => {
                    group.order = _.map(_.slice(order[r], groupOffset[r][g], groupOffset[r][g] + numNodesGroup[r][g]),
                        (pos: number) => pos - groupOffset[r][g]
                    );
                    _.forEach(group.nodes, (node: OrderNode, n: number) => {
                        node.position = positions[r][groupOffset[r][g] + n] - groupOffset[r][g];
                    });
                });
            });
            Timer.stop("doOrder");
        }

        this._addGroupEdges();

        _.forEach(this._groupGraph.components(), (groupGraphComponent: Component<OrderGroup, Edge<any, any>>) => {
            const componentGraph = new OrderGraph();
            const ranks: Array<OrderRank> = [];
            _.forEach(groupGraphComponent.nodes(), (group: OrderGroup) => {
                if (ranks[group.rank.id] === undefined) {
                    ranks[group.rank.id] = new OrderRank();
                    componentGraph.addRank(ranks[group.rank.id]);
                }
                ranks[group.rank.id].addGroup(group, group.id);
                const groupNodes = group.nodes;
                group.nodes = [];
                _.forEach(groupNodes, (node: OrderNode) => {
                    group.addNode(node, node.id);
                });
            });

            _.forEach(componentGraph.nodes(), (newNode: OrderNode) => {
                _.forEach(this.outEdges(newNode.id), (edge: Edge<any, any>) => {
                    componentGraph.addEdge(edge, edge.id);
                });
            });

            componentGraph._addGroupEdges();
            componentGraph._addRankEdges();

            if (componentGraph.edges().length === 0) {
                // when there are no edges, no need to order
                return;
            }

            doOrder(componentGraph);
        });
    }

    /**
     * Adapted from Barth, W., Jünger, M., & Mutzel, P. (2002, August). Simple and efficient bilayer cross counting.
     * In International Symposium on Graph Drawing (pp. 130-141). Springer, Berlin, Heidelberg.
     * @param numNorth
     * @param numSouth
     * @param edges
     * @private
     */
    private _countCrossings(numNorth: number, numSouth: number, edges: Array<[number, number, number]>): number {
        // build south sequence
        const sortedEdges = _.sortBy(edges, edge => edge[0] * numSouth + edge[1]);
        const southSequence = _.map(sortedEdges, edge => edge[1]);
        const weights = _.map(sortedEdges, edge => edge[2]);

        // build the accumulator tree
        let firstIndex = 1;
        while (firstIndex < numSouth) {
            firstIndex *= 2; // number of tree nodes
        }
        const treeSize = 2 * firstIndex - 1;
        firstIndex -= 1; // index of leftmost leaf
        const tree = _.fill(new Array(treeSize), 0);

        // compute the total weight of the crossings
        let crossWeight = 0;
        _.forEach(southSequence, (south: number, i: number) => {
            let index = south + firstIndex;
            tree[index] += weights[i];
            let weightSum = 0;
            while (index > 0) {
                if (index % 2) {
                    weightSum += tree[index + 1];
                }
                index = Math.floor((index - 1) / 2);
                tree[index] += weights[i];
            }
            crossWeight += weights[i] * weightSum;
        });
        return crossWeight;
    }
}