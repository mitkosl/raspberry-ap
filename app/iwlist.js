var exec = require("child_process").exec;
var config = require("../config.json");

/*****************************************************************************\
    Return a function which is responsible for using "iwlist scan" to figure
    out the list of visible SSIDs along with their RSSI (and other info)
\*****************************************************************************/
module.exports = function (cmd_options, callback) {
    // Handle case where no options are passed in
    if (typeof (cmd_options) == "function" && typeof (callback) == "undefined") {
        callback = cmd_options;
        cmd_options = "";
    }

    var fields_to_extract = {
        "ssid": /ESSID:\"(.*)\"/,
        "quality": /Quality=(\d+\/\d+)/,
        "signal_strength": /.*Signal level=(-?\d+)/,
        "encrypted": /Encryption key:(on)/,
        "open": /Encryption key:(off)/,
        "frequency": /Frequency:(\d+\.?\d+)/,
    };

    console.log(`sudo iwlist ${config.wifi_interface} scan`);
    exec(`sudo iwlist scan`, function (error, stdout, stderr) {
        // Handle errors from running "iwlist scan"
        if (error) {
            return callback(error, output)
        }

        /* The output structure looks like this:
        [
            {
                interface: "wlan0",
                scan_results: [
                    { ssid: "WifiB", address: "...", "signal_strength": 57 },
                    { ssid: "WifiA", address: "...", "signal_strength": 35 }
                ]
            },
            ...
        ] */
        var output = [],
            interface_entry = null,
            current_cell = null;

        function append_previous_cell() {
            if (current_cell != null && interface_entry != null) {
                if (typeof (current_cell["ssid"]) != "undefined" &&
                    current_cell["ssid"] != "") {
                    interface_entry["scan_results"].push(current_cell);
                }
                current_cell = null;
            }
        }

        function get_unique_networks(nets) {
            let networksSet = new Set();
            let networks = [];
            if (nets) {
                nets.forEach(n => {
                    networksSet.add(n.ssid);
                });
                networksSet.forEach(element => {
                    var n = nets.find(x => x.ssid == element);
                    networks.push(n);
                });
            }
            return networks;
        }

        function append_previous_interface() {
            append_previous_cell();
            if (interface_entry != null) {
                var sorted_list = interface_entry.scan_results.sort((a, b) => {
                    var aa = parseInt(a.signal_strength);
                    var bb = parseInt(b.signal_strength);
                    if (aa < bb) {
                        return 1;
                    }
                    if (aa > bb) {
                        return -1;
                    }
                    return 0;
                });
                var sorted_networks = get_unique_networks(sorted_list);
                var interface_entry_copy = JSON.parse(JSON.stringify(interface_entry));
                interface_entry_copy.scan_results = sorted_networks;
                output.push(interface_entry_copy);
                interface_entry = null;
            }
        }

        // Parse the result, build return object
        lines = stdout.split("\n");
        for (var idx in lines) {
            line = lines[idx].trim();

            // Detect new interface
            var re_new_interface = line.match(/([^\s]+)\s+Scan completed :/);
            if (re_new_interface) {
                console.log("Found new interface: " + re_new_interface[1]);
                append_previous_interface();
                interface_entry = {
                    "interface": re_new_interface[1],
                    "scan_results": []
                };
                continue;
            }

            // Detect new cell
            var re_new_cell = line.match(/Cell ([0-9]+) - Address: (.*)/);
            if (re_new_cell) {
                append_previous_cell();
                current_cell = {
                    "cell_id": parseInt(re_new_cell[1]),
                    "address": re_new_cell[2],
                };
                continue;
            }

            // Handle other fields we want to extract
            for (var key in fields_to_extract) {
                var match = line.match(fields_to_extract[key]);
                if (match) {
                    current_cell[key] = match[1];
                }
            }
        }

        // Add the last item we tracked
        append_previous_interface();

        return callback(null, output);
    });
}