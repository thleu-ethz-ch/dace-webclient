import DagreLayouter from "./dagreLayouter";
import dagre from "dagre";
import * as _ from "lodash";

export default class DagreLayouterFast extends DagreLayouter {
    graphOptions(withLabels) {
        return _.assign(super.graphOptions(withLabels), {ranker: "longest-path"});
    }
}