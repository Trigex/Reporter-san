// Includes
const Discord = require('discord.js');

// Constant data
const TOKEN = "";
const ADMIN_IDS = [""];
const SERVER_RULES = [
    "1) Don't be a butthead"
];

// Bot client
var bot = new Discord.Client();
// Global active reports map
var active_reports = new Map();

/* === Classes === */

// Container for report form data
class Report {
    reporter_tag = null;
    violated_rule_id = null;
    violating_tag = null;
    violated_in_channel = null;
    report_summary = null;
    constructor(reporter_tag, violating_tag, violated_rule_id, violated_in_channel, report_summary) {
        this.reporter_tag = reporter_tag;
        this.violating_tag = violating_tag;
        this.violated_rule_id = violated_rule_id;
        this.violated_in_channel = violated_in_channel;
        this.report_summary = report_summary;
    }

    // Returns the current step this report is on.
    // The report is broken down into 4 parts,
    // the violating tag prompt, the violated rule
    // prompt, the violated in channel prompt,
    // and the aditional information prompt.
    // These are represented with step IDs of 1, 2, 3, and 4 respectively
    report_step() {
        // this one should never be returned lol
        if(this.reporter_tag === null) {
           return 0;
        }

        if(this.violating_tag === null) {
            return 1;
        }

        if (this.violated_rule_id === null) {
            return 2;
        }

        if(this.violated_in_channel === null) {
            return 3;
        }

        if(this.report_summary === null) {
            return 4;
        }
    }
}

/* === Misc functions === */

function user_has_active_report(tag) {
    has_report = false;
    // Iterate the active reports, to check if this reporting user already has an active report open.
    for(let [key, value] of active_reports) {
        if(key === tag) {
            has_report = true;
        }
    }

    return has_report;
}

function remove_active_report(tag) {
    return active_reports.delete(tag);
}

function rule_id_to_text(id) {
    return SERVER_RULES[id-1];
}

async function finish_report(tag) {
    // get users report object
    let report = active_reports.get(tag);
    if(report !== undefined) {
        console.info(`Report submitter: ${report.reporter_tag}`);
        console.info(`Report violater: ${report.violating_tag}`);
        console.info(`Report rule violated: ${report.violated_rule_id}`);
        console.info(`Report additional information: ${report.report_summary}`);

        // send report to administrators
        ADMIN_IDS.forEach(async (id) => {
            let user = await bot.users.fetch(id);
            user.send(`A report has been submitted by @${report.reporter_tag}!`);
            user.send(`The report is concerning the user @${report.violating_tag}`);
            user.send(`The user allegedly violated rule #${report.violated_rule_id} (\"${rule_id_to_text(Number(report.violated_rule_id))}\"") in the channel ${report.violated_in_channel}`);
            if(report.report_summary != null) {
                user.send(`The reporter gave the following additional information: ${report.report_summary}`);
            }
        });

        // remove report from active reports
        remove_active_report(tag);
    }
}

/* === Bot event handlers === */

// Log on successful authentication
bot.on('ready', () => {
    console.info(`Logged in as ${bot.user.tag}.`);
});

// On any sent channel message
bot.on('message', msg => {
    switch(msg.content) {
        /* The help command gives a brief summary of how to use the bot */
        case '!help':
            break;
        /* The cancel command allows the user to cancel a report request they have opened */
        case '!cancel':
            if(remove_active_report(msg.author.tag)) {
                msg.author.send("Your report request has been canceled.");
            } else {
                msg.author.send("You don't have an active report request. You may send !report to open one.");
            }
            break;
        /* The report command has the bot DM the reporting user a report form,
         * then forwards this form to server administrators to handle. */
        // TODO: In the future, possibly have this log the report to some sort of persistent storage
        case '!report':
            console.info(`A report has been requested by ${msg.author.tag}`)
           
            // check if user has an active report already open
            new_report = user_has_active_report(msg.author.tag);

            if(new_report) {
                msg.author.send("You already have a report form open. Please complete it, or send !cancel, before starting another.");
            } else {
                // add new report to active reports map, with the reporters' tag as the key
                active_reports.set(msg.author.tag, new Report(msg.author.tag, null, null, null, null));
                ReportCommand(msg, false);
            }
            break;
        case '!finish':
            // check if user has an active report already open
            if(user_has_active_report(msg.author.tag)) {
                if(active_reports.get(msg.author.tag).report_step() === 4) {
                    // finish the report!
                    finish_report(msg.author.tag);
                    msg.author.send("The report was successfully submited!");
                }
            }
            break;
        /* Any other text, if DM'd to the bot (not in a server channel), is assumed
         * to be form data text.
         */
        default:
            // Check if the text was a DM
            if(msg.channel instanceof Discord.DMChannel) {
                // Check if the user has an active report
                if(user_has_active_report(msg.author.tag)) {
                    // Call the report command, which will handle the next form prompt
                    ReportCommand(msg, true);
                } else { // If one isn't open, prompt the randomly messaging user to open a report lol
                    msg.author.send("If you would like to report a user for violating a server rule, please send !report.")
                }
            }
            break;
    }
});

/* === Command functions === */

function ReportCommand(msg, is_form_data) {
    // Get the user's report
    let report = active_reports.get(msg.author.tag);
    if(report !== undefined) {
        switch(report.report_step()) {
            // violater tag prompt
            case 1:
                if(!is_form_data) {
                    msg.author.send("You have requested to report a user for violating server rules. The information you provide will be forwarded to server administrators. Please answer all questions as best you can. To cancel your report, at any time simply send !cancel");
                    msg.author.send("`What is the Discord name and tag you would like to report? (e.g, Example#1111):`");
                } else {
                    // TODO: Add validation on this to check for a proper tag.
                    report.violating_tag = msg.content;
                }
                break;
            // violated rule prompt
            case 2:
                if(!is_form_data) {
                    msg.author.send("`Please submit the number of the rule you believe the user violated, from the following rules:`");

                    let rules = "";
                    // create one rules string from the rules array
                    SERVER_RULES.forEach((rule) => {
                        rules += rule + "\n";
                    });

                    msg.author.send("```"+rules+"```");
                } else {
                    // TODO: Add validation on this to check for a in-bounds numeric value
                    report.violated_rule_id = msg.content;
                }
                break;
            // violated in channel prompt
            case 3:
                if(!is_form_data) {
                    msg.author.send("`Please send the channel the rule was broken in. You may send just the alphanumeric name of the channel, without the emojis in the channel name. (e.g., if someone broke a rule in #「💬」￤talk, you may simply send \"#talk\", or \"talk\")`")
                } else {
                    report.violated_in_channel = msg.content;
                }
                break;
            // Additional information prompt
            case 4:
                if(!is_form_data) {
                    msg.author.send("`Please submit any additional information about this report you would like to add in a single message. If you have no additional information to add, send !finish`");
                } else {
                    report.report_summary = msg.content;
                    // finish report
                    finish_report(msg.author.tag);
                    msg.author.send("The report was successfully submited!");
                }
                break;
        }
    }
    // If form data has been submitted, recall this function to send the next prompt
    if(is_form_data) {
        ReportCommand(msg, false);
    }
}

// Authenticate with bot token
bot.login(TOKEN);
