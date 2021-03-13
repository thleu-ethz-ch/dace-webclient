import * as _ from "lodash";
import Edge from "../graph/edge";
import Graph from "../graph/graph";
import OrderGroup from "./orderGroup";
import OrderNode from "./orderNode";
import OrderRank from "./orderRank";

export default class OrderGraph {
    private _rankGraph: Graph<OrderRank, Edge<any, any>>;
    private _groupGraph: Graph<OrderGroup, Edge<any, any>>;
    private _nodeGraph: Graph<OrderNode, Edge<any, any>>;

    private _groupsAlreadyOrdered: boolean = false;

    constructor() {
        this._rankGraph = new Graph<OrderRank, Edge<any, any>>();
        this._groupGraph = new Graph<OrderGroup, Edge<any, any>>();
        this._nodeGraph = new Graph<OrderNode, Edge<any, any>>();
    }

    public addRank(rank: OrderRank) {
        rank.orderGraph = this;
        return this._rankGraph.addNode(rank);
    }

    public addGroup(group: OrderGroup) {
        return this._groupGraph.addNode(group);
    }

    public addNode(node: OrderNode) {
        return this._nodeGraph.addNode(node);
    }

    public addEdge(edge: Edge<any, any>) {
        return this._nodeGraph.addEdge(edge);
    }

    private _addParentEdges() {
        _.forEach(this._nodeGraph.edges(), (edge: Edge<any, any>) => {
            const srcGroupId = this._nodeGraph.node(edge.src).group.id;
            const dstGroupId = this._nodeGraph.node(edge.dst).group.id;
            const groupEdge = this._groupGraph.edgeBetween(srcGroupId, dstGroupId);
            if (groupEdge === undefined) {
                this._groupGraph.addEdge(new Edge(srcGroupId, dstGroupId));
                const srcRankId = this._groupGraph.node(srcGroupId).rank.id;
                const dstRankId = this._groupGraph.node(dstGroupId).rank.id;
                if (!this._rankGraph.hasEdge(srcRankId, dstRankId)) {
                    this._rankGraph.addEdge(new Edge(srcRankId, dstRankId));
                }
            } else {
                groupEdge.weight++;
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

    public orderedGroups() {
        return this._groupGraph.toposort();
    }

    public edges() {
        return this._nodeGraph.edges();
    }

    public groupEdges() {
        return this._groupGraph.edges();
    }

    public sourceGroups(): Array<OrderGroup> {
        return this._groupGraph.sources();
    }

    public sinkGroups(): Array<OrderGroup> {
        return this._groupGraph.sinks();
    }

    public components(): Array<OrderGraph> {
        const components = [];
        /*_.forEach(this._groupGraph.components(), (groupGraph: Graph<OrderGroup, Edge<any, OrderGroup>>) => {
            const component = new OrderGraph();
            component._groupGraph = groupGraph;
            const groups = groupGraph.nodes();
            _.forEach(groups, (group: OrderGroup) => {
                _.forEach(group.nodes, (node: OrderNode) => {
                    node.group = group;
                    component._nodeGraph.addNode(_.clone(node), node.id);
                });
            });
            _.forEach(groups, (group: OrderGroup) => {
                _.forEach(group.nodes, (node: OrderNode) => {
                    _.forEach(this._nodeGraph.outEdges(node.id), (edge: OrderEdge) => {
                        component._nodeGraph.addEdge(_.clone(edge), edge.id);
                    });
                });
            });
            components.push(component);
        });*/
        _.forEach(this._nodeGraph.components(), nodeGraph => {
            const component = new OrderGraph();
            component._nodeGraph = nodeGraph;
        });
        return components;
    }

    public order(downward: boolean = true): void {
        this._addParentEdges();

        // 1. order groups within ranks
        if (!this._groupsAlreadyOrdered) {
            const auxGraph = new OrderGraph();
            auxGraph._groupsAlreadyOrdered = true;
            const nodeMap = new Map();
            _.forEach(this._rankGraph.nodes(), (rank: OrderRank) => {
                const auxRank = new OrderRank(true);
                auxRank.order = [0];
                auxGraph.addRank(auxRank);
                const auxGroup = new OrderGroup(rank, rank.isFixed);
                auxRank.addGroup(auxGroup);
                _.forEach(rank.groups, group => {
                    const auxNode = new OrderNode(null);
                    nodeMap.set(group.id, auxGroup.addNode(auxNode));
                });
            });
            _.forEach(this._groupGraph.edges(), edge => {
                auxGraph.addEdge(new Edge(nodeMap.get(edge.src), nodeMap.get(edge.dst), edge.weight));
            });
            auxGraph.order();
            _.forEach(auxGraph._groupGraph.nodes(), group => {
                group.reference.order = group.order;
            });
        }

        // 2. order nodes within groups

        console.log();
        console.log();
        console.log("ORDERING");

        const ranks = this._rankGraph.toposort();

        const groupOffsets = []; // number of nodes in groups left of this group by group id
        const numNodesGroup = []; // number of nodes per group per rank
        const numNodesRank = []; // total number of nodes per rank
        _.forEach(ranks, (rank: OrderRank, r: number) => {
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
        _.forEach(this._groupGraph.nodes(), (group: OrderGroup) => {
            _.forEach(group.nodes, (node: OrderNode, nodeIndex) => {
                nodeIndexes[node.id] = groupOffsets[group.id] + nodeIndex;
            });
        });
        const group = [];
        const groupOffset = []; // number of nodes in groups left of this group by rank
        const neighborsDown = [];
        const neighborsUp = [];
        const order = []; // current order of this level (e. g. 2, 0, 1)
        const positions = []; // inverse of order (e. g. 1, 2, 0)
        const crossings = []; // number of crossings above each rank

        // set neighbors
        _.forEach(ranks, (rank: OrderRank, r: number) => {
            groupOffset[r] = [];
            neighborsDown[r] = [];
            neighborsUp[r] = [];
            order[r] = _.range(numNodesRank[r]);
            positions[r] = _.clone(order[r]);
            crossings[r] = Number.POSITIVE_INFINITY;
            _.forEach(rank.groups, (group: OrderGroup, g: number) => {
                groupOffset[r][g] = groupOffsets[group.id];
                _.forEach(group.nodes, (node: OrderNode, n: number) => {
                    const pos = groupOffsets[group.id] + n;
                    neighborsDown[r][pos] = [];
                    neighborsUp[r][pos] = [];
                    _.forEach(this._nodeGraph.outEdges(node.id), (edge: Edge<any, any>) => {
                        neighborsDown[r][pos].push(nodeIndexes[edge.dst]);
                    });
                    _.forEach(this._nodeGraph.inEdges(node.id), (edge: Edge<any, any>) => {
                        neighborsUp[r][pos].push(nodeIndexes[edge.src]);
                    });
                });
            });
        });


        console.log("groupOffset", _.cloneDeep(groupOffset));
        console.log("neighborsDown", _.cloneDeep(neighborsDown));
        console.log("neighborsUp", _.cloneDeep(neighborsUp));
        console.log("order", _.cloneDeep(order));
        console.log("positions", _.cloneDeep(positions));
        console.log("crossings", _.cloneDeep(crossings));

        let hasImproved = true;
        while (hasImproved) {
            hasImproved = false;
            let firstRank = downward ? 1 : ranks.length - 2;
            let lastRank = downward ? ranks.length - 1 : 0;
            const direction = downward ? 1 : -1;
            const neighbors = downward ? neighborsUp : neighborsDown;
            for (let r = firstRank; r - direction !== lastRank; r += direction) {
                const newOrder = new Array(order[r].length);
                for (let g = 0; g < numNodesGroup[r].length; ++g) {
                    if (ranks[r].groups[g].isFixed) {
                        continue;
                    }
                    const neighborRank = r - direction;
                    // calculate mean position of neighbors
                    const nodeMeans = [];
                    for (let pos = groupOffset[r][g]; pos < groupOffset[r][g] + numNodesGroup[r][g]; ++pos) {
                        let sum = 0;
                        for (let neighbor = 0; neighbor < neighbors[r][pos].length; ++neighbor) {
                            sum += positions[neighborRank][neighbors[r][pos][neighbor]];
                        }
                        nodeMeans.push([pos, sum / neighbors[r][pos].length]);
                    }
                    console.log("nodeMeans[" + r + "][" + g + "]", nodeMeans);
                    // sort by the means
                    const newGroupOrder = _.map(_.sortBy(nodeMeans, pair => pair[1]), pair => pair[0]);
                    for (let n = 0; n < numNodesGroup[r][g]; ++n) {
                        newOrder[groupOffset[r][g] + n] = newGroupOrder[n];
                    }
                    if (!_.isEqual(newOrder, order[r]) || crossings[r] === Number.POSITIVE_INFINITY) {
                        // count crossings with new order
                        const edges = [];
                        for (let pos = 0; pos < order[r].length; ++pos) {
                            for (let neighbor = 0; neighbor < neighbors[r][newOrder[pos]].length; ++neighbor) {
                                edges.push([
                                    positions[neighborRank][neighbors[r][newOrder[pos]][neighbor]],
                                    newOrder[pos],
                                ]);
                            }
                        }
                        const newCrossings = this._countCrossings(order[neighborRank].length, order[r].length, edges);
                        if (newCrossings < crossings[r]) {
                            hasImproved = true;
                            crossings[r] = newCrossings;
                            order[r] = newOrder;
                            for (let pos = 0; pos < order[r].length; ++pos) {
                                positions[r][order[r][pos]] = pos;
                            }
                        }
                    }
                }
            }
            downward = !downward;
        }
        _.forEach(ranks, (rank: OrderRank, r: number) => {
            _.forEach(rank.groups, (group: OrderGroup, g: number) => {
                group.order = _.slice(order[r], groupOffset[r][g], groupOffset[r][g] + numNodesGroup[r][g]);
            });
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
    private _countCrossings(numNorth: number, numSouth: number, edges: Array<[number, number]>): number {
        // build south sequence
        const southSequence = _.map(_.sortBy(edges, edge => edge[0] * numNorth + edge[1]), edge => edge[1]);

        // build the accumulator tree
        let firstIndex = 1;
        while (firstIndex < numSouth) {
            firstIndex *= 2; // number of tree nodes
        }
        const treeSize = 2 * firstIndex - 1;
        firstIndex -= 1; // index of leftmost leaf
        const tree = _.fill(new Array(treeSize), 0);

        // count the crossings
        let count = 0;
        _.forEach(southSequence, (i: number) => {
            let index = i + firstIndex;
            tree[index]++;
            while (index > 0) {
                if (index % 2) {
                    count += tree[index + 1];
                }
                index = Math.floor((index - 1) / 2);
                tree[index]++;
            }
        });
        return count;
    }

}