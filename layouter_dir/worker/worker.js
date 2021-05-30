importScripts("../dist/layoutLib.js");

const _ = layoutLib.lodash;

function alignMedian(numRanks, numNodesPerRank, levelGraphNodes, numEdges, levelGraphEdges, neighbors, preference, targetEdgeLength) {
    const levelGraph = new layoutLib.levelGraph.LevelGraph();
    const ranks = new Array(numRanks);
    let n = 0;
    for (let r = 0; r < numRanks; ++r) {
        const numNodes = numNodesPerRank[r];
        ranks[r] = new Array(numNodes);
        for (let pos = 0; pos < numNodes; ++pos) {
            const id = levelGraphNodes[n++];
            const width = levelGraphNodes[n++];
            const isFirst = levelGraphNodes[n++];
            const isLast = levelGraphNodes[n++];
            const levelNode = new layoutLib.levelGraph.LevelNode(null, r, width, isFirst);
            levelNode.position = pos;
            levelNode.isLast = isLast;
            levelGraph.addNode(levelNode, id);
            ranks[r][pos] = levelNode;
        }
    }
    for (let e = 0; e < numEdges; ++e) {
        levelGraph.addEdge(new layoutLib.graph.Edge(levelGraphEdges[3 * e], levelGraphEdges[3 * e + 1], levelGraphEdges[3 * e + 2]));
    }

    const firstRank = (neighbors === "UP" ? 1 : (ranks.length - 2));
    const lastRank = (neighbors === "UP" ? (ranks.length - 1) : 0);
    const verticalDir = (neighbors === "UP" ? 1 : -1);
    const neighborOutMethod = (neighbors === "UP" ? "outEdges" : "inEdges");
    const neighborInMethod = (neighbors === "UP" ? "inEdges" : "outEdges");
    const neighborEdgeInAttr = (neighbors === "UP" ? "dst" : "src");

    const blockPerNode = new Array(levelGraph.maxId() + 1);
    const nodesPerBlock = new Array(levelGraph.maxId() + 1);
    const blockWidths = new Array(levelGraph.maxId() + 1);
    const blockGraph = new layoutLib.rankGraph.RankGraph();
    const auxBlockGraph = new layoutLib.graph.Graph();

    const r = firstRank - verticalDir;
    let blockId = 0;
    for (let n = 0; n < ranks[r].length; ++n) {
        blockGraph.addNode(new layoutLib.rankGraph.RankNode(blockId.toString()));
        auxBlockGraph.addNode(new layoutLib.graph.Node(blockId.toString()), blockId);
        blockPerNode[ranks[r][n].id] = blockId;
        nodesPerBlock[blockId] = [ranks[r][n].id];
        blockWidths[blockId] = ranks[r][n].width;
        blockId++;
    }
    for (let n = 1; n < ranks[r].length; ++n) {
        const edgeLength = (ranks[r][n - 1].width + ranks[r][n].width) / 2 + targetEdgeLength;
        blockGraph.addEdge(new layoutLib.graph.Edge(blockPerNode[ranks[r][n - 1].id], blockPerNode[ranks[r][n].id], edgeLength));
    }
    for (let r = firstRank; r - verticalDir !== lastRank; r += verticalDir) {
        // create sorted list of neighbors
        const neighbors = new Array(ranks[r].length);
        const neighborsUsable = new Array(ranks[r].length);
        _.forEach(ranks[r], (node, n) => {
            neighbors[n] = [];
            neighborsUsable[n] = [];
        });
        _.forEach(ranks[r - verticalDir], (neighbor, n) => {
            _.forEach(levelGraph[neighborOutMethod](neighbor.id), (edge) => {
                const node = levelGraph.node(edge[neighborEdgeInAttr]);
                neighbors[node.position].push(n);
            });
        });

        // mark segments that cross a heavy segment as non-usable

        let heavyLeft = -1;
        let n = 0;
        for (let tmpN = 0; tmpN < ranks[r].length; ++tmpN) {
            if (tmpN === ranks[r].length - 1 || _.filter(levelGraph[neighborInMethod](ranks[r][tmpN].id), edge => edge.weight === 1000000000).length > 0) {
                let heavyRight = ranks[r - verticalDir].length + 1;
                if (_.filter(levelGraph[neighborInMethod](ranks[r][tmpN].id), edge => edge.weight === 1000000000).length > 0) {
                    heavyRight = neighbors[tmpN][0];
                }
                while (n <= tmpN) {
                    _.forEach(neighbors[n], (neighborPos, neighborIndex) => {
                        neighborsUsable[n][neighborIndex] = neighborPos >= heavyLeft && neighborPos <= heavyRight;
                    });
                    n++;
                }
                heavyLeft = heavyRight;
            }
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
                _.forEach(tryOrder, (neighborIndex) => {
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
                blockGraph.addNode(new layoutLib.rankGraph.RankNode(blockId.toString()));
                auxBlockGraph.addNode(new layoutLib.graph.Node(blockId.toString()), blockId);
                blockPerNode[ranks[r][n].id] = blockId;
                nodesPerBlock[blockId] = [ranks[r][n].id];
                blockWidths[blockId] = ranks[r][n].width;
                blockId++;
            } else {
                const blockId = blockPerNode[neighbor.id];
                blockPerNode[ranks[r][n].id] = blockId;
                nodesPerBlock[blockId].push(ranks[r][n].id);
                blockWidths[blockId] = Math.max(blockWidths[blockId], ranks[r][n].width);
            }
        }
        for (let n = 1; n < ranks[r].length; ++n) {
            const edgeLength = (ranks[r][n - 1].width + ranks[r][n].width) / 2 + targetEdgeLength;
            blockGraph.addEdge(new layoutLib.graph.Edge(blockPerNode[ranks[r][n - 1].id], blockPerNode[ranks[r][n].id], edgeLength));
        }
    }

    const xAssignment = new Array(levelGraph.maxId() + 1);

    // compact
    blockGraph.rank();
    _.forEach(levelGraph.nodes(), (node) => {
        xAssignment[node.id] = blockGraph.node(blockPerNode[node.id]).rank;
    });

    // move blocks that are only connected on the right side as far right as possible
    _.forEach(levelGraph.edges(), edge => {
        if (blockPerNode[edge.src] !== blockPerNode[edge.dst]) {
            auxBlockGraph.addEdge(new layoutLib.graph.Edge(blockPerNode[edge.src], blockPerNode[edge.dst]));
        }
    });
    _.forEach(auxBlockGraph.nodes(), block => {
        const blockId = block.id;
        const nodeX = xAssignment[nodesPerBlock[blockId][0]] + blockWidths[blockId] / 2;
        let hasLeftEdge = false;
        let hasRightEdge = false;
        _.forEach(auxBlockGraph.neighbors(blockId), neighbor => {
            const neighborX = xAssignment[nodesPerBlock[neighbor.id][0]] - blockWidths[neighbor.id] / 2;
            if (nodeX < neighborX) {
                hasRightEdge = true;
            } else {
                hasLeftEdge = true;
            }
        });
        if (hasRightEdge && !hasLeftEdge) {
            // figure how much the block can be moved
            let minRightEdgeLength = Number.POSITIVE_INFINITY;
            _.forEach(blockGraph.outEdges(blockId), outEdge => {
                const neighborX = xAssignment[nodesPerBlock[outEdge.dst][0]] - blockWidths[outEdge.dst] / 2;
                minRightEdgeLength = Math.min(minRightEdgeLength, neighborX - nodeX);
            });
            // move it
            if (minRightEdgeLength > targetEdgeLength) {
                const offset = minRightEdgeLength - targetEdgeLength;
                _.forEach(nodesPerBlock[blockId], nodeId => {
                    xAssignment[nodeId] += offset;
                });
            }
        }
    });
    return xAssignment;
}

function test() {
    return;
}

layoutLib.workerpool.worker({
    alignMedian: alignMedian,
    test: test,
});
