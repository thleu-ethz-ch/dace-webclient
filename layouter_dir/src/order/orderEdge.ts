import Edge from "../graph/edge";
import Graph from "../graph/graph";
import OrderGroup from "./orderGroup";
import OrderNode from "./orderNode";

export default class OrderEdge extends Edge<Graph<any, any>, OrderGroup | OrderNode>
{
    // empty
}
