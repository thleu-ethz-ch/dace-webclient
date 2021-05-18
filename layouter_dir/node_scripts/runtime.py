import subprocess
import json

def combineTimeSlot(summarySlot, timeSlots, level = 0):
    if level > 0:
        summarySlot["times"] = list(map(lambda slot: slot["sum"], timeSlots))
    for name in timeSlots[0]["children"]:
        summarySlot["children"][name] = {"children": {}}
        combineTimeSlot(summarySlot["children"][name], list(map(lambda slot: slot["children"][name], timeSlots)), level + 1)

def combineTimes(times):
    summary = {"children": {}}
    combineTimeSlot(summary, times)
    return summary

coldTimes = []
for run in range(10):
    p = subprocess.Popen(['node', 'runtime_cold.js'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    (stdout, stderr) = p.communicate()
    coldTimes.append(json.loads(stdout.decode()))

times = {"cold": combineTimes(coldTimes)}
p = subprocess.Popen(['node', 'runtime_warm.js'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
(stdout, stderr) = p.communicate()
times["warm"] = json.loads(stdout.decode())
print(json.dumps(times))