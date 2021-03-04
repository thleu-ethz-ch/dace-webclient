import Parser from "./parser";

export default class Loader {
    static load(name) {
        return fetch("./graphs/" + name + ".json")
            .then(response => response.json())
            .then(json => Parser.parse(json));
    }
}