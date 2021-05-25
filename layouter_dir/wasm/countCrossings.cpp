#include <stdio.h>
#include <cmath>
#include <vector>
#include <algorithm>
#include <sys/time.h>

extern "C" {
    int* countingTree;

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
        for (int i = 0; i < treeSize; ++i) {
            countingTree[i] = 0;
        }

        // compute the total weight of the crossings
        int crossWeight = 0;
        for (int i = 0; i < numEdges; ++i) {
            int index = sortedEdges[i].first.second + firstIndex;
            countingTree[index] += sortedEdges[i].second;
            int weightSum = 0;
            while (index > 0) {
                if (index % 2) {
                    weightSum += countingTree[index + 1];
                }
                index = floor((index - 1) / 2);
                countingTree[index] += sortedEdges[i].second;
            }
            crossWeight += sortedEdges[i].second * weightSum;
        }
        return crossWeight;
    }

    int countCrossings(int r, const std::vector<int> &testOrder, const std::vector<std::vector<std::pair<int, int>>> &neighbors, const std::vector<int> &northPositions) {
        std::vector<std::pair<std::pair<int, int>, int>> edges;

        for (int southPos = 0; southPos < (int)testOrder.size(); ++southPos) {
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
        bool fewerOrEqualCrossingsTotal = (newCrossingsNorth + newCrossingsSouth) <= (prevCrossingsNorth + prevCrossingsSouth);
        if (fewerCrossingsNorth && fewerOrEqualCrossingsTotal) {
            crossings[r + crossingOffsetNorth] = newCrossingsNorth;
            if (r != lastRank) {
                crossings[r + crossingOffsetSouth] = newCrossingsSouth;
            }
            order[r] = newOrder;
            for (int pos = 0; pos < (int)newOrder.size(); ++pos) {
                positions[r][newOrder[pos]] = pos;
            }
            int fewerCrossingsTotal = (newCrossingsNorth + newCrossingsSouth) < (prevCrossingsNorth + prevCrossingsSouth);
            //printf("fewer crossings, north: before: %d, after: %d, south: before: %d, after: %d\n", prevCrossingsNorth, newCrossingsNorth, prevCrossingsSouth, newCrossingsSouth);
            return (1 + (fewerCrossingsTotal ? 1 : 0));
        } else {
            //printf("not fewer crossings, north: before: %d, after: %d, south: before: %d, after: %d\n", prevCrossingsNorth, newCrossingsNorth, prevCrossingsSouth, newCrossingsSouth);
            return 0;
        }
    }

    bool sortPairByFirst(const std::pair<float, int> &a, const std::pair<float, int> &b)
    {
        return (a.first < b.first);
    }

    void reorder(int numRanks, int* inputArray, int inputSize) {
        int* inputStart = inputArray;
        int *order = (int*)malloc(inputSize * sizeof(int));
        int *positions = (int*)malloc(2 * inputSize * sizeof(int));
        int *edges = (int*)malloc(2 * inputSize * sizeof(int));

        std::vector<std::vector<int>> order(numRanks);
        std::vector<std::vector<std::vector<std::vector<std::pair<int, int>>>>> edges(numRanks);

        int maxNodesPerRank = 0;

        // read nodes
        for (int r = 0; r < numRanks; ++r) {
            int numNodes = *inputArray++;
            order[r].resize(numNodes);
            for (int n = 0; n < numNodes; ++n) {
                order[r][n] = *inputArray++;
            }
            edges[r].resize(2);
            edges[r][0].resize(numNodes);
            edges[r][1].resize(numNodes);
            maxNodesPerRank = std::max(maxNodesPerRank, numNodes);
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
        int signDirection = 1; // downward: 1; upward: -1
        int crossingOffsetNorth = !boolDirection;
        int crossingOffsetSouth = boolDirection;

        // create local structures
        std::vector<std::vector<int>> positions(numRanks);
        for (int r = 0; r < numRanks; ++r) {
            positions[r].resize(order[r].size());
            for (int pos = 0; pos < (int)order[r].size(); ++pos) {
                positions[r][order[r][pos]] = pos;
            }
        }
        std::vector<int> crossings(numRanks, 1000000000);
        crossings[0] = 0;
        int treeSize = 1;
        while (treeSize < maxNodesPerRank) {
            treeSize *= 2;
        }
        treeSize *= 2;
        countingTree = (int*)calloc(treeSize, sizeof(int));

        int improveCounter = 2;
        while (improveCounter > 0) {
            //printf(boolDirection ? "DOWN\n" : "UP\n");
            improveCounter--;
            int firstRank = (boolDirection ? 1 : (numRanks - 2));
            int lastRank = (boolDirection ? (numRanks - 1) : 0);
            for (int r = firstRank; r - signDirection != lastRank; r += signDirection) {
                //printf("rank %d\n", r);
                if (crossings[r + crossingOffsetNorth] == 0) {
                    continue;
                }
                int northR = r - signDirection;
                int numNodes = (int)order[r].size();
                //bool hasChanged = true;
                //while (hasChanged) {
                    //hasChanged = false;
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
                            nodeMeans.push_back(std::make_pair((float)sum / (float)num, n));
                        } else {
                            nodeMeans.push_back(std::make_pair((float)pos, n)); 
                        }
                    }

                    // sort by the means
                    std::stable_sort(nodeMeans.begin(), nodeMeans.end(), sortPairByFirst);
                    for (int pos = 0; pos < numNodes; ++pos) {
                        newNodeOrder[pos] = nodeMeans[pos].second;
                    }
                    
                    // then reorder nodes
                    std::vector<std::pair<int, int>> changes;
                    //std::vector<int> originalOrder = order[r];
                    getChanges(newNodeOrder, positions[r], changes);
                    for (auto changeIt = changes.cbegin(); changeIt != changes.cend(); ++changeIt) {
                        std::vector<int> tmpOrder = order[r];
                        for (int i = changeIt->first; i <= changeIt->second; ++i) {
                            tmpOrder[i] = newNodeOrder[i];
                        }
                        /*for (int i = 0; i < (int)newNodeOrder.size(); ++i) {
                            printf("%d,", tmpOrder[i]);
                        }
                        printf("\n");*/
                        int result = tryNewOrder(tmpOrder, r, crossingOffsetNorth, crossingOffsetSouth, boolDirection, signDirection, lastRank, order, positions, crossings, edges);
                        if (result == 2) {
                            improveCounter = 2;
                        }
                    }
                //}
            }
            boolDirection = !boolDirection;
            signDirection *= -1;
            crossingOffsetNorth = !boolDirection;
            crossingOffsetSouth = boolDirection;
        }
        /*int numCrossings = 0;
        for (int r = 1; r < numRanks; ++r) {
            numCrossings += countCrossings(r, order[r], edges[r][0], positions[r - 1]);
        }
        printf("crossings: %d\n", numCrossings);*/

        // write back
        for (int r = 0; r < numRanks; ++r) {
            for (int n = 0; n < (int)order[r].size(); ++n) {
                *inputStart = order[r][n];
                inputStart++;
            }
        }
        free(countingTree);
    }

    int main() {
        FILE *input = fopen("test_unreadable.txt", "r");
        if (input == NULL) {
            fprintf(stderr, "Input file not found!\n");
            return 0;
        }
        int numRanks;
        if (!fscanf(input, "%d", &numRanks)) {
            fprintf(stderr, "Error reading input!\n");
            fclose(input);
            return 0;
        }
        int* heap = (int*)calloc(1 << 30, sizeof(int));
        int* pointer = &heap[0];
        while (fscanf(input, ",%d", pointer++) > 0) {
            // just read
        }
        int numNodes = 0;
        int numEdges = 0;
        struct timeval start_t, end_t;
        gettimeofday(&start_t, NULL);
        reorder(numRanks, heap, (--pointer - &heap[0]));
        gettimeofday(&end_t, NULL);
   
        double time = double(end_t.tv_sec - start_t.tv_sec) * 1000.0;
        time += double(end_t.tv_usec - start_t.tv_usec) / 1000.0;
        printf("%lf ms\n", time);
        return 1;
    }
}
