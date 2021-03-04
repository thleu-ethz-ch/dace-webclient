import * as _ from "lodash";
import DagreLayouter from "./dagreLayouter";

export default class DagreLayouterFast extends DagreLayouter {
    graphOptions(withLabels) {
        return _.assign(super.graphOptions(withLabels), {ranker: "longest-path"});
    }
}