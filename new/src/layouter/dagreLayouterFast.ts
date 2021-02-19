import DagreLayouter from "./dagreLayouter";
import dagre from "dagre";

export default class DagreLayouterFast extends DagreLayouter {
    applyDagre(dagreGraph) {
        console.log(dagre.runLayout);
        dagre.layout(dagreGraph, {ranker: "longest-path"});
    }
}