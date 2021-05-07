import * as _ from "lodash";

export default class Timer
{
    private static _timers: Map<string, [number, number]> = new Map();

    public static start(path: Array<string>) {
        const id = path.join("|");
        let sum = 0;
        const timer =  Timer._timers.get(id);
        if (timer !== undefined) {
            if (timer[1] !== null) {
                return;
            }
            sum = timer[0];
        }
        Timer._timers.set(id, [sum, Date.now()])
    }

    public static stop(path: Array<string>) {
        const id = path.join("|");
        const time = Date.now();
        const timer = Timer._timers.get(id);
        timer[0] += time - timer[1];
        timer[1] = null;
    }

    public static printTimes(): void {
        const timePerPath = {children: {}};
        Timer._timers.forEach(([sum, start], id) => {
            const path = id.split("|");
            let slot = timePerPath;
            _.forEach(path, part => {
                if (slot.children[part] === undefined) {
                    slot.children[part] = {
                        time: sum,
                        children: {},
                    }
                } else {
                    slot = slot.children[part];
                }
            });
        });
        const printTimes = (slot, name = "", level = 0, parentTime = 0) => {
            if (level > 0) {
                let timeString = (slot.time > 1000 ? ((slot.time / 1000).toFixed(3) + " s") : (slot.time + " ms"));
                if (level > 1) {
                    timeString += "; " + (100 * slot.time / parentTime).toFixed(0) + "% of parent";
                }
                console.log(_.repeat("| ", level - 1) + name + ": " + timeString);
            }
            for (let name in slot.children) {
                printTimes(slot.children[name], name, level + 1, slot.time);
            }
        };
        printTimes(timePerPath);
    }
}