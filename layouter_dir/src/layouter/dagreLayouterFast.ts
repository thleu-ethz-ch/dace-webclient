import * as _ from "lodash";
import DagreLayouter from "./dagreLayouter";

export default class DagreLayouterFast extends DagreLayouter {
    graphOptions() {
        return _.assign(super.graphOptions(), {ranker: "longest-path"});
    }
}