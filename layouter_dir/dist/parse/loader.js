import Parser from "./parser";
var Loader = /** @class */ (function () {
    function Loader() {
    }
    Loader.load = function (name) {
        return fetch("./test/" + name + ".sdfg")
            .then(function (response) { return response.json(); })
            .then(function (json) { return Parser.parse(json); });
    };
    return Loader;
}());
export default Loader;
//# sourceMappingURL=loader.js.map