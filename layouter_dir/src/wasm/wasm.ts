import {Module} from "../../wasm/reorder";
import * as _ from "lodash";
import OrderRank from "../order/orderRank";

interface Neighbor {
    end: number;
    weight: number;
}

export default class Wasm
{
    moduleReady: boolean = false;
    waiting: Array<(bool) => void> = [];

    constructor() {
        Module.onRuntimeInitialized = () => {
            this.moduleReady = true;
            _.forEach(this.waiting, (resolve) => {
                resolve(true);
            });
        }
        Module.run();
    }

    async waitUntilReady(): Promise<void> {
        if (!this.moduleReady) {
            await new Promise((resolve: (bool) => void) => {
                this.waiting.push(resolve);
            });
        }
        return Promise.resolve();
    }

    async reorder(order: Array<Array<number>>, neighborsUp: Array<Array<Neighbor>>, maxId: number, numEdgesPerRank: Array<number>): Promise<void> {
        await this.waitUntilReady();
        let pointer = 0;
        const heap = Module["HEAP32"];
        let numNodes = 0;
        for (let r = 0; r < order.length; ++r) {
            heap[pointer++] = order[r].length;
            numNodes += order[r].length;
            _.forEach(order[r], (n: number) => {
                heap[pointer++] = n;
            });
        }
        let numEdges = 0;
        for (let r = 1; r < order.length; ++r) {
            heap[pointer] = numEdgesPerRank[r];
            numEdges += heap[pointer++];
            _.forEach(order[r], (nodeId: number) => {
                _.forEach(neighborsUp[nodeId], (neighbor: Neighbor) => {
                    let weight = neighbor.weight;
                    if (weight === Number.POSITIVE_INFINITY) {
                        weight = 1;
                    }
                    heap[pointer++] = neighbor.end;
                    heap[pointer++] = nodeId;
                    heap[pointer++] = weight;
                });
            });
        }
        //if (order.length === 65) {
            //this.download("test_symm.txt", order.length + "," + numNodes + "," + maxId + "," + numEdges + "," + _.slice(heap, 0, pointer).toString())
        //}
        Module._reorder(order.length, numNodes, maxId, numEdges, heap.byteOffset);
        pointer = 0;
        for (let r = 0; r < order.length; ++r) {
            for (let pos = 0; pos < order[r].length; ++pos) {
                order[r][pos] = heap[pointer++]
            }
        }
    }

    download(filename, text) {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }

}
