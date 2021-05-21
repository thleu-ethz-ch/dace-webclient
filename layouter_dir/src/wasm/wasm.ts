import {Module} from "../../wasm/reorder";
import * as _ from "lodash";
import OrderRank from "../order/orderRank";

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

    async reorder(order: Array<Array<number>>, neighborsDown: Array<Array<Array<number>>>, weightsDown: Array<Array<Array<number>>>): Promise<void> {
        await this.waitUntilReady();
        let pointer = 0;
        for (let r = 0; r < order.length; ++r) {
            Module["HEAP32"][pointer++] = order[r].length;
            _.forEach(order[r], (n: number) => {
                Module["HEAP32"][pointer++] = n;
            });
        }
        for (let r = 0; r < order.length - 1; ++r) {
            Module["HEAP32"][pointer++] = _.sum(_.map(neighborsDown[r], "length"));
            _.forEach(neighborsDown[r], (neighbors: Array<number>, from: number) => {
                _.forEach(neighbors, (to: number, i: number) => {
                    let weight = weightsDown[r][from][i];
                    if (weight === Number.POSITIVE_INFINITY) {
                        weight = 1;
                    }
                    Module["HEAP32"][pointer++] = from;
                    Module["HEAP32"][pointer++] = to;
                    Module["HEAP32"][pointer++] = weight;
                });
            });
        }
        console.log(order.length, Module["HEAP32"]);
        Module._reorder(order.length, Module["HEAP32"]);
        console.log(order.length, Module["HEAP32"]);
        pointer = 0;
        for (let r = 0; r < order.length; ++r) {
            for (let pos = 0; pos < order[r].length; ++pos) {
                order[r][pos] = Module["HEAP32"][pointer++]
            }
        }
    }
}
