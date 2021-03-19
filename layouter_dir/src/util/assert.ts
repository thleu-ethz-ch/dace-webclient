import * as _ from "lodash";

export default class Assert
{
    static assertNone(collection: Array<any>, predicate: (any) => boolean, message: string) {
        console.assert(!_.some(_.map(collection, predicate)), message, _.filter(collection, predicate));
    }

    static assertNumber(input, message) {
        console.assert(typeof input === "number" && !isNaN(input), message, input);
    }
}
