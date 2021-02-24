import DagreLayouter from "./dagreLayouter";
import dagre from "dagre";

export default class DagreLayouterFast extends DagreLayouter {
    applyDagre(dagreGraph) {
        dagre.layout(dagreGraph, {ranker: "longest-path"});
    }
}