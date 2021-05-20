#include <cmath>

extern "C" {
    typedef struct Edge {
        double north;
        double south;
        double weight;
    } Edge;

    int compareEdge(const void * a_p, const void * b_p) {
        Edge a = *(Edge *)a_p;
        Edge b = *(Edge *)b_p;
        if (a.north > b.north || (a.north == b.north && a.south > b.south)) {
            return 1;
        } else {
            return -1;
        }
    }

    /**
     * Adapted from Barth, W., Jünger, M., & Mutzel, P. (2002, August). Simple and efficient bilayer cross counting.
     * In International Symposium on Graph Drawing (pp. 130-141). Springer, Berlin, Heidelberg.
     */
    double countCrossings(double numNorth, double numSouth, double numEdges, double* rawEdges) {
        // build south sequence
        Edge* edges = (Edge*)malloc(numEdges * sizeof(Edge));
        for (int i = 0; i < numEdges; ++i) {
            edges[i] = {rawEdges[3 * i], rawEdges[3 * i + 1], rawEdges[3 * i + 2]};
        }
        qsort(edges, numEdges, sizeof(Edge), compareEdge);

        // build the accumulator tree
        double firstIndex = 1;
        while (firstIndex < numSouth) {
            firstIndex *= 2; // number of tree nodes
        }
        double treeSize = 2 * firstIndex - 1;
        firstIndex -= 1; // index of leftmost leaf
        double* tree = (double*)calloc(treeSize, sizeof(double));

        // compute the total weight of the crossings
        double crossWeight = 0;
        for (int i = 0; i < numEdges; ++i) {
            int index = edges[i].south + firstIndex;
            tree[index] += edges[i].weight;
            double weightSum = 0;
            while (index > 0) {
                if (index % 2) {
                    weightSum += tree[index + 1];
                }
                index = floor((index - 1) / 2);
                tree[index] += edges[i].weight;
            }
            crossWeight += edges[i].weight * weightSum;
        }
        return crossWeight;
    }
}
