import {inPlaceSort, sort} from 'fast-sort';
import * as _ from "lodash";

interface Edge {
    north: number;
    south: number;
    weight: number;
}

interface Neighbor {
    end: number;
    weight: number;
}

interface Change {
    begin: number;
    end: number;
}

interface NodeMean {
    n: number;
    mean: number;
}

export default function fastReorder(order: Array<Array<number>>, positions: Array<Array<number>>, crossings: Array<number>, neighborsUp: Array<Array<Array<number>>>, weightsUp: Array<Array<Array<number>>>, neighborsDown: Array<Array<Array<number>>>, weightsDown: Array<Array<Array<number>>>) {
    let countingEdges: Array<Edge>;
    let countingTree: Array<number>;

    const neighbors = [
        new Array(order.length),
        new Array(order.length),
    ];
    for (let r = 0; r < order.length; ++r) {
        neighbors[0][r] = new Array(order[r].length);
        neighbors[1][r] = new Array(order[r].length);
        for (let n = 0; n < order[r].length; ++n) {
            neighbors[0][r][n] = new Array(neighborsUp[r][n].length);
            neighbors[1][r][n] = new Array(neighborsDown[r][n].length);
            for (let e = 0; e < neighborsUp[r][n].length; ++e) {
                let weight = weightsUp[r][n][e];
                if (weight === Number.POSITIVE_INFINITY) {
                    weight = 1;
                }
                neighbors[0][r][n][e] = {end: neighborsUp[r][n][e], weight: weight};
            }
            for (let e = 0; e < neighborsDown[r][n].length; ++e) {
                let weight = weightsDown[r][n][e];
                if (weight === Number.POSITIVE_INFINITY) {
                    weight = 1;
                }
                neighbors[1][r][n][e] = {end: neighborsDown[r][n][e], weight: weight};
            }
        }
    }

    /**
     * Adapted from Barth, W., Jünger, M., & Mutzel, P. (2002, August). Simple and efficient bilayer cross counting.
     * In International Symposium on Graph Drawing (pp. 130-141). Springer, Berlin, Heidelberg.
     */
    const countCrossingsRank = (numNorth: number, numSouth: number, numEdges: number): number => {
        // build the accumulator tree
        let firstIndex = 1;
        while (firstIndex < numSouth) {
            firstIndex *= 2; // number of tree nodes
        }
        const treeSize = 2 * firstIndex - 1;
        firstIndex -= 1; // index of leftmost leaf
        for (let i = 0; i < treeSize; ++i) {
            countingTree[i] = 0;
        }

        // compute the total weight of the crossings
        let crossWeight = 0;
        for (let i = 0; i < numEdges; ++i) {
            let index = countingEdges[i].south + firstIndex;
            countingTree[index] += countingEdges[i].weight;
            let weightSum = 0;
            while (index > 0) {
                if (index % 2) {
                    weightSum += countingTree[index + 1];
                }
                index = Math.floor((index - 1) / 2);
                countingTree[index] += countingEdges[i].weight;
            }
            crossWeight += countingEdges[i].weight * weightSum;
        }
        return crossWeight;
    }

    /*const compareNorthSouth => (const void* a, const void* b) {
        Edge* edgeA = (Edge*)a;
        Edge* edgeB = (Edge*)b;
        if (edgeA->north != edgeB->north) {
            return edgeA->north - edgeB->north;
        }
        return edgeA->south - edgeB->south;
    }

    int compareMeans(const void* a, const void* b) {
        NodeMean* meanA = (NodeMean*)a;
        NodeMean* meanB = (NodeMean*)b;
        return (meanA->mean < meanB->mean) ? -1 : (meanA->mean > meanB->mean ? 1 : 0);
    }*/

    const countCrossings = (r: number, numNodes: number, testOrder: Array<number>, neighborsPerNode: Array<Array<Neighbor>>, northPositions: Array<number>) => {
        let edgePointer = 0;
        for (let southPos = 0; southPos < numNodes; ++southPos) {
            const southN = testOrder[southPos];
            for (let e = 0; e < neighborsPerNode[southN].length; ++e) {
                const neighbor = neighborsPerNode[southN][e];
                const northPos = northPositions[neighbor.end];
                countingEdges[edgePointer++] = {north: southPos, south: northPos, weight: neighbor.weight};
            }
        }
        countingEdges.length = edgePointer;
        inPlaceSort(countingEdges).asc([
            e => e.north,
            e => e.south,
        ]);
        //console.log(_.map(countingEdges, edge => "[" + edge.north + "," + edge.south + "]").toString());
        return countCrossingsRank(numNodes, northPositions.length, edgePointer);
    }

    const getChanges = (numNodes: number, newOrder: Array<number>, positions: Array<number>, changes: Array<Change>, permutation: Array<number>) => {
        for (let pos = 0; pos < numNodes; ++pos) {
            permutation[pos] = positions[newOrder[pos]];
        }
        let seqStart = -1;
        let seqEnd = -1;
        let resultPointer = 0;
        for (let pos = 0; pos < numNodes; ++pos) {
            if (permutation[pos] > pos) {
                if (seqStart == -1) {
                    seqStart = pos;
                    seqEnd = permutation[pos];
                } else {
                    if (seqEnd < pos) {
                        changes[resultPointer++] = {begin: seqStart, end: pos - 1};
                        seqStart = pos;
                        seqEnd = permutation[pos];
                    } else {
                        seqEnd = Math.max(seqEnd, permutation[pos]);
                    }
                }
            }
            if (permutation[pos] == pos && seqStart != -1 && seqEnd < pos) {
                changes[resultPointer++] = {begin: seqStart, end: pos - 1};
                seqStart = -1;
            }
        }
        if (seqStart != -1) {
            changes[resultPointer++] = {begin: seqStart, end: numNodes - 1};
        }
        return resultPointer;
    }

    const tryNewOrder = (newOrder: Array<number>, r: number, crossingOffsetNorth: number, crossingOffsetSouth: number, boolDirection: boolean, signDirection: number, lastRank: number, order: Array<number>) => {
        // count crossings with new order
        const numNodes = positions[r].length;
        const prevCrossingsNorth = crossings[r + crossingOffsetNorth];
        const newCrossingsNorth = countCrossings(r, numNodes, newOrder, neighbors[boolDirection ? 0 : 1][r], positions[r - signDirection]);

        let newCrossingsSouth = 0;
        let prevCrossingsSouth = 0;
        if (r != lastRank) {
            prevCrossingsSouth = crossings[r + crossingOffsetSouth];
            newCrossingsSouth = countCrossings(r, numNodes, newOrder, neighbors[boolDirection ? 1 : 0][r], positions[r + signDirection]);
        }
        const fewerCrossingsNorth = newCrossingsNorth < prevCrossingsNorth;
        const fewerOrEqualCrossingsTotal = (newCrossingsNorth + newCrossingsSouth) <= (prevCrossingsNorth + prevCrossingsSouth);
        if (fewerCrossingsNorth && fewerOrEqualCrossingsTotal) {
            crossings[r + crossingOffsetNorth] = newCrossingsNorth;
            if (r != lastRank) {
                crossings[r + crossingOffsetSouth] = newCrossingsSouth;
            }
            for (let n = 0; n < numNodes; ++n) {
                order[n] = newOrder[n];
            }
            for (let pos = 0; pos < positions[r].length; ++pos) {
                positions[r][newOrder[pos]] = pos;
            }
            const fewerCrossingsTotal = (newCrossingsNorth + newCrossingsSouth) < (prevCrossingsNorth + prevCrossingsSouth);
            return (1 + (fewerCrossingsTotal ? 1 : 0));
        } else {
            return 0;
        }
    }

    const reorder = () => {
        const numRanks = order.length;
        const maxNodesPerRank = _.max(_.map(order, "length"));
        const maxEdgesPerRank = _.max(_.map(neighbors[0], rankNeighbors => _.sum(_.map(rankNeighbors, "length"))));
        const maxEdgeWeight = _.max(_.map(neighbors[0], rankNeighbors => _.max(_.map(rankNeighbors, nodeNeighbors => _.max(_.map(nodeNeighbors, "weight"))))));
        const multiplicator = maxEdgeWeight * maxEdgesPerRank + 1;
        countingEdges = Array(maxEdgesPerRank);

        let boolDirection = true; // downward: 1; upward: 0
        let signDirection = 1; // downward: 1; upward: -1
        let crossingOffsetNorth = boolDirection ? 0 : 1;
        let crossingOffsetSouth = boolDirection ? 1 : 0;

        let treeSize = 1;
        while (treeSize < maxNodesPerRank) {
            treeSize *= 2;
        }
        treeSize *= 2;
        countingTree = Array(treeSize);
        const changes = Array(maxNodesPerRank);
        const nodeMeans = Array(maxNodesPerRank);
        const newNodeOrder = Array(maxNodesPerRank);
        const tmpOrder = Array(maxNodesPerRank);
        const permutation =  Array(maxNodesPerRank);

        let improveCounter = 2;
        while (improveCounter > 0) {
            improveCounter--;
            const firstRank = (boolDirection ? 1 : (numRanks - 2));
            const lastRank = (boolDirection ? (numRanks - 1) : 0);
            for (let r = firstRank; r - signDirection != lastRank; r += signDirection) {
                if (crossings[r + crossingOffsetNorth] == 0) {
                    continue;
                }
                const northR = r - signDirection;
                const numNodes = order[r].length;
                for (let pos = 0; pos < numNodes; ++pos) {
                    const n = order[r][pos];
                    let sum = 0;
                    let num = 0;
                    for (let e = 0; e < neighbors[boolDirection ? 0 : 1][r][n].length; ++e) {
                        const edge = neighbors[boolDirection ? 0 : 1][r][n][e];
                        const neighborPos = positions[northR][edge.end];
                        sum += edge.weight * neighborPos;
                        num += edge.weight;
                    }
                    if (num > 0) {
                        nodeMeans[pos] = {n: n, mean: multiplicator * sum / num + pos};
                    } else {
                        nodeMeans[pos] = {n: n, mean: multiplicator * pos + pos};
                    }
                }

                // sort by the means
                nodeMeans.length = numNodes;
                inPlaceSort(nodeMeans).asc(n => n.mean);
                for (let pos = 0; pos < numNodes; ++pos) {
                    newNodeOrder[pos] = nodeMeans[pos].n;
                }

                const numChanges = getChanges(numNodes, newNodeOrder, positions[r], changes, permutation);
                for (let c = 0; c < numChanges; ++c) {
                    const change = changes[c];
                    for (let n = 0; n < numNodes; ++n) {
                        tmpOrder[n] = order[r][n];
                    }
                    for (let i = change.begin; i <= change.end; ++i) {
                        tmpOrder[i] = newNodeOrder[i];
                    }
                    const result = tryNewOrder(tmpOrder, r, crossingOffsetNorth, crossingOffsetSouth, boolDirection, signDirection, lastRank, order[r]);
                    if (result == 2) {
                        improveCounter = 2;
                    }
                }
            }
            boolDirection = !boolDirection;
            signDirection *= -1;
            crossingOffsetNorth = boolDirection ? 0 : 1;
            crossingOffsetSouth = boolDirection ? 1 : 0;
        }
    }

    reorder();
    for (let r = 1; r < order.length; ++r) {
        crossings[r] = countCrossings(r, order[r].length, order[r], neighbors[0][r], positions[r - 1]);
    }
}