import * as _ from "lodash";

export default class Assert
{
    static assertNone(collection: Array<any>, predicate: (element: any, i: number) => boolean, message: string) {
        const matches = _.filter(collection, predicate);
        Assert.assert(matches.length === 0, message, matches);
    }

    static assertNumber(input: any, message: string) {
        const predicate = (typeof input === "number" && !isNaN(input));
        Assert.assert(predicate, message, input);
    }

    static assertImplies(premise: boolean, implication: boolean, message) {
        Assert.assert(!premise || implication, message);
    }

    static assert(predicate: boolean, message: string, ...objects: Array<object>) {
        console.assert(predicate, message, ...objects);
        if (!predicate) {
            throw new Error("Assertion failed.");
        }
    }
}
