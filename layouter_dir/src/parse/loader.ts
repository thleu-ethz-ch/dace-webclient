import Parser from "./parser";

export default class Loader {
    static load(name) {
        return fetch("./test/" + name + ".sdfg")
            .then(response => response.json())
            .then(json => Parser.parse(json));
    }
}