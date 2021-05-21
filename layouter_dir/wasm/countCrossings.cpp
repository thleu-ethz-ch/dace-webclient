#include <cmath>
#include <vector>
#include <algorithm>

extern "C" {

    /**
     * Adapted from Barth, W., Jünger, M., & Mutzel, P. (2002, August). Simple and efficient bilayer cross counting.
     * In International Symposium on Graph Drawing (pp. 130-141). Springer, Berlin, Heidelberg.
     */
    int countCrossingsRank(int numNorth, int numSouth, const std::vector<std::pair<std::pair<int, int>, int>> &sortedEdges) {
        int numEdges = sortedEdges.size();

        // build the accumulator tree
        int firstIndex = 1;
        while (firstIndex < numSouth) {
            firstIndex *= 2; // number of tree nodes
        }
        int treeSize = 2 * firstIndex - 1;
        firstIndex -= 1; // index of leftmost leaf
        int* tree = (int*)calloc(treeSize, sizeof(int));

        // compute the total weight of the crossings
        int crossWeight = 0;
        for (int i = 0; i < numEdges; ++i) {
            int index = sortedEdges[i].first.second + firstIndex;
            tree[index] += sortedEdges[i].second;
            int weightSum = 0;
            while (index > 0) {
                if (index % 2) {
                    weightSum += tree[index + 1];
                }
                index = floor((index - 1) / 2);
                tree[index] += sortedEdges[i].second;
            }
            crossWeight += sortedEdges[i].second * weightSum;
        }
        return crossWeight;
    }

    int countCrossings(int r, const std::vector<int> &testOrder, const std::vector<std::vector<std::pair<int, int>>> &neighbors, const std::vector<int> &northPositions) {
        std::vector<std::pair<std::pair<int, int>, int>> edges;

        for (int southPos = 0; southPos < testOrder.size(); ++southPos) {
            int southN = testOrder[southPos];
            for (auto neighborIt = neighbors[southN].cbegin(); neighborIt != neighbors[southN].end(); ++neighborIt) {
                int northPos = northPositions[neighborIt->first];
                edges.push_back(std::make_pair(std::make_pair(southPos, northPos), neighborIt->second));
            }
        }
        std::sort(edges.begin(), edges.end());
        return countCrossingsRank(testOrder.size(), northPositions.size(), edges);
    }

    void getChanges(const std::vector<int> &newOrder, const std::vector<int> &positions, std::vector<std::pair<int, int>> &result) {
        int numNodes = newOrder.size();
        std::vector<int> permutation(numNodes);
        for (int pos = 0; pos < numNodes; ++pos) {
            permutation[pos] = positions[newOrder[pos]];
        }
        int seqStart = -1;
        int seqEnd = -1;
        for (int pos = 0; pos < numNodes; ++pos) {
            if (permutation[pos] > pos) {
                if (seqStart == -1) {
                    seqStart = pos;
                    seqEnd = permutation[pos];
                } else {
                    if (seqEnd < pos) {
                        result.push_back(std::make_pair(seqStart, pos - 1));
                        seqStart = pos;
                        seqEnd = permutation[pos];
                    } else {
                        seqEnd = std::max(seqEnd, permutation[pos]);
                    }
                }
            }
            if (permutation[pos] == pos && seqStart != -1 && seqEnd < pos) {
                result.push_back(std::make_pair(seqStart, pos - 1));
                seqStart = -1;
            }
        }
        if (seqStart != -1) {
            result.push_back(std::make_pair(seqStart, numNodes - 1));
        }
    }

    int tryNewOrder(const std::vector<int> &newOrder, int r, int crossingOffsetNorth, int crossingOffsetSouth, int boolDirection, int signDirection, int lastRank, std::vector<std::vector<int>> &order, std::vector<std::vector<int>> &positions, std::vector<int> &crossings, const std::vector<std::vector<std::vector<std::vector<std::pair<int, int>>>>> &edges) {
        // count crossings with new order
        int prevCrossingsNorth = crossings[r + crossingOffsetNorth];
        int newCrossingsNorth = countCrossings(r, newOrder, edges[r][!boolDirection], positions[r - signDirection]);

        int newCrossingsSouth = 0;
        int prevCrossingsSouth = 0;
        if (r != lastRank) {
            prevCrossingsSouth = crossings[r + crossingOffsetSouth];
            newCrossingsSouth = countCrossings(r, newOrder, edges[r][boolDirection], positions[r + signDirection]);
        }
        bool fewerCrossingsNorth = newCrossingsNorth < prevCrossingsNorth;
        bool fewerOrEqualCrossingsTotal = (newCrossingsNorth + newCrossingsSouth <= prevCrossingsNorth + prevCrossingsSouth);
        if (fewerCrossingsNorth && fewerOrEqualCrossingsTotal) {
            crossings[r + crossingOffsetNorth] = newCrossingsNorth;
            if (r != lastRank) {
                crossings[r + crossingOffsetSouth] = newCrossingsSouth;
            }
            order[r] = newOrder;
            for (int pos = 0; pos < newOrder.size(); ++pos) {
                positions[r][newOrder[pos]] = pos;
            }
            int fewerCrossingsTotal = (newCrossingsNorth + newCrossingsSouth < prevCrossingsNorth + prevCrossingsSouth);
            return (1 + (fewerCrossingsTotal ? 1 : 0));
        } else {
            return 0;
        }
    }

    void reorder(int numRanks, int* inputArray) {
        int* inputStart = inputArray;

        std::vector<std::vector<int>> order(numRanks);
        std::vector<std::vector<std::vector<std::vector<std::pair<int, int>>>>> edges(numRanks);

        // read nodes
        int maxId = 0;
        for (int r = 0; r < numRanks; ++r) {
            int numNodes = *inputArray++;
            order[r].resize(numNodes);
            for (int n = 0; n < numNodes; ++n) {
                order[r][n] = *inputArray++;
            }
            edges[r].resize(2);
            edges[r][0].resize(numNodes);
            edges[r][1].resize(numNodes);
        }

        // read edges
        for (int r = 1; r < numRanks; ++r) {
            int numEdges = *inputArray++;
            for (int e = 0; e < numEdges; ++e) {
                int from = *inputArray++;
                int to = *inputArray++;
                int weight = *inputArray++;
                edges[r - 1][1][from].push_back(std::make_pair(to, weight)); // 1: down-neighbors 
                edges[r][0][to].push_back(std::make_pair(from, weight)); // 0: up-neighbors,
            }
        }
        
        bool boolDirection = 1; // downward: 1; upward: 0
        bool signDirection = 1; // downward: 1; upward: -1
        int crossingOffsetNorth = !boolDirection;
        int crossingOffsetSouth = boolDirection;

        // create local structures
        std::vector<std::vector<int>> positions(numRanks);
        for (int r = 0; r < numRanks; ++r) {
            positions[r].resize(order[r].size());
            for (int pos = 0; pos < order[r].size(); ++pos) {
                positions[r][order[r][pos]] = pos;
            }
        }
        std::vector<int> crossings(numRanks, __INT32_MAX__);
        crossings[0] = 0;
        int improveCounter = 2;
        while (improveCounter > 0) {
            improveCounter--;
            int firstRank = (boolDirection ? 1 : (numRanks - 2));
            int lastRank = (boolDirection ? (numRanks - 1) : 0);
            for (int r = firstRank; r - signDirection != lastRank; r += signDirection) {
                if (crossings[r + crossingOffsetNorth] == 0) {
                    continue;
                }
                int northR = r - signDirection;
                int numNodes = order[r].size();
                bool hasChanged = true;
                while (hasChanged) {
                    hasChanged = false;
                    std::vector<int> newNodeOrder(numNodes);
                    std::vector<std::pair<float, int>> nodeMeans;
                    nodeMeans.reserve(numNodes);
                    for (int pos = 0; pos < numNodes; ++pos) {
                        int n = order[r][pos];
                        int sum = 0;
                        int num = 0;
                        for (auto it = edges[r][!boolDirection][n].cbegin(); it != edges[r][!boolDirection][n].cend(); ++it) {
                            int weight = it->second;
                            int neighborPos = positions[northR][it->first];
                            sum += weight * neighborPos;
                            num += weight;
                        }
                        if (num > 0) {
                            nodeMeans.push_back(std::make_pair(sum / num, n));
                        } else {
                            nodeMeans.push_back(std::make_pair(pos, n));
                        }
                    }

                    // sort by the means
                    std::sort(nodeMeans.begin(), nodeMeans.end());
                    for (int pos = 0; pos < numNodes; ++pos) {
                        newNodeOrder[pos] = nodeMeans[pos].second;
                    }

                    // then reorder nodes
                    std::vector<std::pair<int, int>> changes;
                    getChanges(newNodeOrder, positions[r], changes);
                    for (auto changeIt = changes.cbegin(); changeIt != changes.cend(); ++changeIt) {
                        std::vector<int> tmpOrder = order[r];
                        for (int i = changeIt->first; i <= changeIt->second; ++i) {
                            tmpOrder[i] = newNodeOrder[i];
                        }
                        int result = tryNewOrder(newNodeOrder, r, crossingOffsetNorth, crossingOffsetSouth, boolDirection, signDirection, lastRank, order, positions, crossings, edges);
                        if (result > 0) {
                            hasChanged = true;
                        }
                        if (result == 2) {
                            improveCounter = 2;
                        }
                    }
                }
            }
            boolDirection = !boolDirection;
            signDirection *= -1;
            crossingOffsetNorth = !boolDirection;
            crossingOffsetSouth = boolDirection;
        }
        // write back
        for (int r = 0; r < numRanks; ++r) {
            for (int n = 0; n < order[r].size(); ++n) {
                *inputStart = order[r][n];
                inputStart++;
            }
        }

    }
}
