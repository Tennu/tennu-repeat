var format = require("util").format;
var inspect = require("util").inspect;

module.exports = {
    name: "repeat",
    requiresRoles: ["admin"],
    init: function (client, deps) {
        // struct repeatState {
        //     interval: i32,
        //     channel: channel
        //     message: Option<String>
        //     timeout: Option<Timeout>
        // }
        var interval;
        var channel;
        var message;
        var timeout;

        function stopRepeat () {
            if (timeout) {
                clearTimeout(timeout);
                timeout = undefined;
                client.debug("RepeatPlugin", "Repeat cleared.");
            } else {
                client.debug("RepeatPlugin", "Tried to clear repeat, but no repeat set.");
            }
        }

        function startRepeat () {
            // TODO(Havvy): Is this one necessary?
            stopRepeat();

            function repeat () {
                console.log(format("REPEATING at %s", Math.floor(Date.now() / 1000) % 600));

                // ASSUME: Client is in specified channel.
                client.say(channel, message);
                timeout = setTimeout(repeat, interval * 1e3);
            }

            timeout = setTimeout(repeat, interval * 1e3);
        }

        // These values are in seconds.
        interval = (Math.ceil(Number(client.config("repeat-interval"))) || 600);
        if (interval < 0 || Number.isNaN(interval) || interval === Infinity) {
            throw new Error("Configuration error: repeat-interval must be a positive finite number of seconds, or not defined (defaulting to 10 minutes");
        }

        message = client.config("repeat-message");
        if (typeof message !== "string" || message === "") {
            if (isRepeating) {
                throw new Error("Configuration error: repeat-autostart is true while repeat-message is not set.");
            }

            message = undefined;
        }

        channel = client.config("repeat-channel");
        if (typeof channel !== "string" || channel[0] !== "#") {
            throw new Error("Configuration error: repeat-channel must be a channel.");
        }

        if (client.config("repeat-autostart")) {
            startRepeat();
        }

        var requiresAdmin = deps.admin.requiresAdmin;
        return {
            handlers: {
                "!repeat": requiresAdmin(function (command) {
                    var subcommands = {
                        "message": function (command) {
                            var newMessage = command.args.slice(1).join(" ");

                            if (message === "") {
                                return "This subcommand is `repeat message <new-message>` and you did not supply a new message.";
                            }

                            message = newMessage;
                            return "Message changed. This message is only changed until I am restarted.";
                        },

                        "interval": function (command) {
                            var newInterval = Math.ceil(Number(command.args[1]));
                            if (newInterval <= 0 || Number.isNaN(newInterval) || newInterval === Infinity) {
                                return "Cannot set interval to that value. Give a positive number of seconds.";
                            }
                            interval = newInterval;
                            return "Interval changed. This interval is only changed until I am restarted.";
                        },

                        "start": function (command) {
                            if (timeout) {
                                return "Message repeat functionality is already running.";
                            } else if (!message) {
                                return "No message to repeat. Use !repeat message <new-message> to set the repeat message first.";
                            } else {
                                startRepeat();
                                return format("Starting repeating message in %s. Interval = %s seconds. Message = %s.", channel, interval, message);
                            }
                        },

                        "stop": function (command) {
                            if (!timeout) {
                                return "Message repeat functionality is already stopped.";
                            } else {
                                stopRepeat();
                                return "Message repeat functionality has been stopped.";
                            }
                        }
                    };

                    var subcommand = command.args[0];

                    if (subcommands[subcommand]) {
                        return subcommands[subcommand](command);
                    } else {
                        return "Unknown subcommand. Available options are 'message', 'interval', 'start', 'stop'.";
                    }
                }),

                "error": function (quitMessage) {
                    stopRepeat();
                }
            },

            "help": require("help.json"),
            "commands": ["repeat"]
        };
    }
};