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

    public addNode(node: OrderNode, id: number = null) {
        return this._nodeGraph.addNode(node, id);
    }

    public addEdge(edge: Edge<any, any>) {
        return this._nodeGraph.addEdge(edge);
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

    public edges() {
        return this._nodeGraph.edges();
    }

    public outEdges(id: number) {
        return this._nodeGraph.outEdges(id);
    }

    public edgeBetween(srcId: number, dstId: number) {
        return this._nodeGraph.edgeBetween(srcId, dstId);
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
            const positions = []; // inverse of order (e. g. 1, 2, 0)
            const crossings = []; // number of crossings above each rank where heavy edges are not so heavy
            const crossingsWithInfinity = []; // number of crossings above each rank where heavy edges are heavy

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
                crossingsWithInfinity[r] = Number.POSITIVE_INFINITY;
                _.forEach(rank.orderedGroups(), (group: OrderGroup, g: number) => {
                    groupOffset[r][g] = groupOffsets[group.id];
                    const groupOrder = _.range(groupOffset[r][g], groupOffset[r][g] + numNodesGroup[r][g]);
                    for (let n = 0; n < numNodesGroup[r][g]; ++n) {
                        order[r][groupOffset[r][g] + n] = groupOrder[n];
                    }
                    _.forEach(group.nodes, (node: OrderNode, n: number) => {
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
            });
            crossings[0] = 0;
            crossingsWithInfinity[0] = 0;

            const countCrossings = (testOrder: Array<number>, r: number, direction: "UP" | "DOWN", useInfinity: boolean = false) => {
                const edges = [];
                const neighbors = (direction === "UP" ? neighborsUp : neighborsDown);
                const weights = (direction === "UP" ? weightsUp : weightsDown);
                const neighborRank = (direction === "UP" ? (r - 1) : (r + 1));
                for (let pos = 0; pos < testOrder.length; ++pos) {
                    for (let neighbor = 0; neighbor < neighbors[r][testOrder[pos]].length; ++neighbor) {
                        let weight = weights[r][testOrder[pos]][neighbor];
                        if (weight === Number.POSITIVE_INFINITY) {
                            if (useInfinity) {
                                weight = 1000000;
                            } else {
                                weight = 1;
                            }
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
                    }
                    downward = !downward;
                }

                Timer.stop("reorder");
            };

            /**
             * Tries to resolve illegal crossings, i. e. crossings of edges with infinite weight.
             */
            const resolve = () => {
                Timer.start("resolve");
                const resolveCrossing = (r: number, heavyNorth: number, heavySouth: number, otherNorth: number, otherSouth: number) => {
                    Assert.assert(groupOffset[r].length === 1, "more than one group");
                    Assert.assert(groupOffset[r - 1].length === 1, "more than one group");
                    if (debug) {
                        console.log(
                            "resolve",
                            ranks[r - 1].groups[0].nodes[order[r - 1][heavyNorth]],
                            ranks[r].groups[0].nodes[order[r][heavySouth]],
                        );
                    }
                    Assert.assertEqual(ranks[r - 1].groups[0].nodes[order[r - 1][heavyNorth]].label(), ranks[r].groups[0].nodes[order[r][heavySouth]].label(), "different nodes");

                    let heavyPerRank = new Map();
                    heavyPerRank.set(r - 1, heavyNorth);
                    heavyPerRank.set(r, heavySouth);
                    let otherPerRank = new Map([[r - 1, new Set([otherNorth])], [r, new Set([otherSouth])]]);
                    _.forEach([1, -1], direction => {
                        const neighbors = (direction === 1 ? neighborsDown : neighborsUp);
                        const weights = (direction === 1 ? weightsDown : weightsUp);
                        let heavyPos = (direction === 1 ? heavyNorth : heavySouth);
                        let tmpR = (direction === 1 ? r - 1 : r);
                        while (neighbors[tmpR][order[tmpR][heavyPos]].length > 0 && weights[tmpR][order[tmpR][heavyPos]][0] === Number.POSITIVE_INFINITY) {
                            heavyPos = positions[tmpR + direction][neighbors[tmpR][order[tmpR][heavyPos]][0]];
                            heavyPerRank.set(tmpR + direction, heavyPos);
                            if (!otherPerRank.has(tmpR + direction)) {
                                otherPerRank.set(tmpR + direction, new Set());
                            }
                            otherPerRank.get(tmpR).forEach((other: number) => {
                                for (let neighbor = 0; neighbor < neighbors[tmpR][order[tmpR][other]].length; ++neighbor) {
                                    otherPerRank.get(tmpR + direction).add(positions[tmpR + direction][neighbors[tmpR][order[tmpR][other]][neighbor]]);
                                }
                            });
                            tmpR += direction;
                        }
                    });

                    // count how many nodes would have to be moved from left to right or from right to left
                    const leftPerRank = [];
                    const rightPerRank = [];
                    let numLeft = 0;
                    let numRight = 0;
                    otherPerRank.forEach((otherPositionsSet: Set<number>, r: number) => {
                        if (otherPositionsSet.size === 0) {
                            return;
                        }
                        const otherPositions =  _.sortBy(Array.from(otherPositionsSet));
                        const index = _.sortedLastIndex(otherPositions, heavyPerRank.get(r));
                        const left = _.slice(otherPositions, 0, index);
                        const right = _.reverse(_.slice(otherPositions, index));
                        if (debug) {
                            console.log("r", r, "heavy", heavyPerRank.get(r), "otherPositions", otherPositions, "index", index, "left", left, "right", right);
                        }
                        if (left.length > 0) {
                            leftPerRank.push([r, left]);
                            numLeft += left.length;
                        }
                        if (right.length > 0) {
                            rightPerRank.push([r, right]);
                            numRight += right.length;
                        }
                    });
                    // move the smaller number of nodes
                    const moveDir = (numLeft < numRight ? 1 : -1);
                    const otherPositionsPerRank = (moveDir === 1 ? leftPerRank : rightPerRank);

                    if (debug) {
                        console.log("indexes per rank", "heavy: ", heavyPerRank, "other:", otherPositionsPerRank);
                    }
                    _.forEach(otherPositionsPerRank, (rankPositions: [number, Array<number>]) => {
                        let r = rankPositions[0];
                        let movingPositions = rankPositions[1];
                        let positionsPointer = 0;
                        if (moveDir === 1) {
                            let offsetMoving = heavyPerRank.get(r) - movingPositions[0] + 1 - movingPositions.length;
                            let offsetNonMoving = 0;
                            for (let p = movingPositions[0]; p <= heavyPerRank.get(r); p++) {
                                if (movingPositions[positionsPointer] === p) {
                                    positions[r][order[r][p]] += offsetMoving;
                                    offsetNonMoving--;
                                    positionsPointer++;
                                } else {
                                    positions[r][order[r][p]] += offsetNonMoving;
                                    offsetMoving--;
                                }
                            }
                        } else {
                            let posMoving = heavyPerRank.get(r);
                            let offsetNonMoving = 0;
                            for (let p = movingPositions[0]; p >= heavyPerRank.get(r); p--) {
                                if (movingPositions[positionsPointer] === p) {
                                    positions[r][order[r][p]] = posMoving++;
                                    offsetNonMoving += 1;
                                    positionsPointer++;
                                } else {
                                    positions[r][order[r][p]] += offsetNonMoving;
                                }
                            }
                        }

                        Assert.assertEqual(_.sortBy(positions[r]), _.range(0, positions[r].length), "positions not consistent");
                        order[r] = _.map(_.sortBy(_.map(positions[r], (pos, n) => [pos, n]), "0"), "1");
                    });

                    const rankCrossingsChanged = _.fill(new Array(ranks.length), false);
                    _.forEach(otherPositionsPerRank, (rankPositions: [number, Array<number>]) => {
                        let r = rankPositions[0];
                        rankCrossingsChanged[r] = true;
                        if (r < ranks.length - 1) {
                            rankCrossingsChanged[r + 1] = true;
                        }
                    });
                    for (let r = 1; r < ranks.length; ++r) {
                        if (rankCrossingsChanged[r]) {
                            crossingsWithInfinity[r] = countCrossings(order[r], r, "UP", true);
                        }
                    }
                }

                for (let r = 1; r < ranks.length; ++r) {
                    crossingsWithInfinity[r] = countCrossings(order[r], r, "UP", true);
                }

                let counter = 0;
                let invalid = false;
                while (_.sum(crossingsWithInfinity) >= 1000000) {
                    if (counter++ === 100) {
                        console.log("break");
                        invalid = true;
                        break;
                    }
                    let hasResolved = false;
                    if (debug) {
                        console.log("resolve", _.sum(crossingsWithInfinity));
                    }
                    for (let r = 1; r < ranks.length; ++r) {
                        if (crossingsWithInfinity[r] >= 1000000) {
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
                            const openSegments = new Set();
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
                                _.forEach(newSegments, newSegment => {
                                    if (hasResolved) {
                                        return; // can not break from forEach
                                    }
                                    const [posNorth, posSouth, heavy] = newSegment;
                                    let newDir = Math.sign(posSouth - posNorth);
                                    openSegments.forEach((openSegment: [number, number, boolean]) => {
                                        if (hasResolved) {
                                            return; // can not break from forEach
                                        }
                                        const [openPosNorth, openPosSouth, openHeavy] = openSegment;
                                        // dir is
                                        let openDir = Math.sign(openPosSouth - openPosNorth);
                                        if ((newDir !== openDir) || (newDir === 1 && posSouth < openPosSouth) || (posNorth < openPosNorth)) {
                                            // segments have different direction or new segment is more vertical
                                            if (openHeavy) {
                                                resolveCrossing(r, openPosNorth, openPosSouth, posNorth, posSouth);
                                                hasResolved = true;
                                            } else if (heavy) {
                                                resolveCrossing(r, posNorth, posSouth, openPosNorth, openPosSouth);
                                                hasResolved = true;
                                            }
                                        }
                                    });
                                    if (newDir !== 0) {
                                        openSegments.add(newSegment);
                                    }
                                });
                                if (hasResolved) {
                                    break;
                                }
                            }
                            if (hasResolved) {
                                break;
                            }
                        }
                    }
                }
                Timer.stop("resolve")
                return !invalid;
            }

            const originalOrder = _.cloneDeep(order);

            reorder(false);
            if (!resolve()) {
                order = _.cloneDeep(originalOrder);
                reorder(true);
                const success = resolve();
                Assert.assert(success, "illegal crossings when starting from original order");
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
                    componentGraph.addEdge(edge);
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