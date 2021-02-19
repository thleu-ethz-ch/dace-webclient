import Shape from "../layout/shape";
import SdfgNode from "./sdfgNode";
import Group from "../layout/group";
import * as _ from "lodash";
import Layouter from "../layouter/layouter";
import SdfgGraph from "./sdfgGraph";
import Size from "../layout/size";
import MapEntry from "./mapEntry";
import MapExit from "./mapExit";
import SimpleShape from "../layout/simpleShape";
import ScopeNode from "./scopeNode";

export class MapNode extends SdfgNode {
    private _elements: Array<SdfgNode>;

    constructor(id: number, nodes: Array<SdfgNode>) {
        super({id: id});
        this._childGraph = new SdfgGraph();
        _.forEach(nodes, (node) => {
            this._childGraph.addNode(node, node.id);
        });
    }

    addEdge(edge) {
        this._childGraph.addEdge(edge);
        edge.graph = this._childGraph;
    }

    shape(x: number, y: number): Shape {
        const group = new Group(x, y);
        //group.addElement(new Rectangle(0, 0, this.size().width, this.size().height, 0xFF0000))

        if (this._childGraphLayout !== null) {
            group.addElement(this._childGraphLayout);
        }
        group.addElements(this.connectorShapes(0, 0));
        return group;
    }

    node(id: number): SdfgNode {
        return this._childGraph.node(id);
    }

    size(): Size {
        return {
            width: Math.max(this._childGraphSize.width, this.connectorsWidth()),
            height: this._childGraphSize.height,
        }
    }
}
