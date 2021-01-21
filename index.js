const Discord = require("discord.js");
const config = require("./config.json");

const client = new Discord.Client({
    partials: ["MESSAGE", "CHANNEL", "REACTION"],
});
var userTickets = new Map();

client.on("ready", () => {
    console.log("Logged in as " + client.user.username);

    const category = client.channels.resolve(config.categoryID).children;
    for (let channel of category) {
        var topic = channel[1].topic.split(" ");
        userTickets.set(topic[2], { channel: channel[1].id, status: topic[5] });
    }

    console.log(`Tickets offen: ${userTickets.size}`);

    client.user.setActivity("Dein Support ist uns wichtig!", { type: "WATCHING" });
});

client.on("message", async message => {
    var memberRoles = await message.guild.members.fetch(message.author.id);
    memberRoles = memberRoles._roles.includes(config.supportrole)
    if (!memberRoles) return;
    if (message.content == "s!shutdown") {
        process.exit();
    }
    if (message.content == "s!react") {
        await message.delete();
        await message.channel.messages.fetch(config.supportmessage).then(message => message.react("✉️"));
    }
})

process.on("unhandledRejection", (error) => {
    console.error("Unhandled promise rejection:", error);
});

client.on("messageReactionAdd", async (reaction, user) => {
    if (user.id === client.user.id) return;

    if (
        reaction.emoji.name == "✅" &&
        reaction.message.guild.members.cache.get(user.id)._roles.includes(config.supportrole)
    ) {
        var ticketowner = reaction.message.channel.topic.split(" ");
        var status = ticketowner[5];
        ticketowner = ticketowner[2];
        if (userTickets.get(ticketowner).status == "Closed") {
            userTickets.delete(ticketowner);
            reaction.message.channel.delete({ "reason": "Ticket System - Ticket geschlossen." });
        }
        return;
    }

    if (
        reaction.emoji.name == "🔓" &&
        userTickets.has(user.id)
    ) {
        if (userTickets.get(user.id).status == "Open") {
            await reaction.users.remove(user.id);
            const msg = await reaction.message.channel.send(`:no_entry: <@${user.id}>, Das Ticket ist schon offen.!`);
            setTimeout(function () {
                msg.delete();
            }, 10000);
            return;
        }
        await reaction.message.reactions.removeAll();
        await reaction.message.channel.overwritePermissions([
            {
                id: user.id,
                allow: ["VIEW_CHANNEL"],
            },
            {
                id: reaction.message.channel.guild.id,
                deny: ["VIEW_CHANNEL"],
            },
            {
                id: config.supportrole,
                allow: ["VIEW_CHANNEL", "MANAGE_CHANNELS", "MANAGE_ROLES"],
            },
        ]);
        const msg = await reaction.message.channel.send({
            embed: { description: `Ticket wiedergeöffnet von ${user.username}` },
        });
        var channelTopic = msg.channel.topic.split(" ");
        channelTopic[5] = "Open";
        channelTopic = channelTopic.join(" ");
        msg.channel.setTopic(channelTopic);
        userTickets.set(user.id, { channel: msg.channel.id, status: "Open" });
        await msg.react("🔒");
    }

    if (
        reaction.emoji.name == "🔒" &&
        userTickets.has(user.id)
    ) {
        if (userTickets.get(user.id).status == "Closed") {
            await reaction.users.remove(user.id);
            const msg = await reaction.message.channel.send(`:no_entry: <@${user.id}>, Das Ticket ist schon geschlossen!`);
            setTimeout(function () {
                msg.delete();
            }, 10000);
            return;
        }
        await reaction.message.reactions.removeAll();
        await reaction.message.channel.overwritePermissions([
            {
                id: user.id,
                deny: ["VIEW_CHANNEL"],
            },
            {
                id: reaction.message.channel.guild.id,
                deny: ["VIEW_CHANNEL"],
            },
            {
                id: config.supportrole,
                allow: ["VIEW_CHANNEL", "MANAGE_CHANNELS", "MANAGE_ROLES"],
            },
        ]);
        const msg = await reaction.message.channel.send({
            embed: { description: `Ticket geschlossen von ${user.username}` },
        });
        var channelTopic = msg.channel.topic.split(" ");
        channelTopic[5] = "Closed";
        channelTopic = channelTopic.join(" ");
        await msg.channel.setTopic(channelTopic);
        userTickets.set(user.id, { channel: msg.channel.id, status: "Closed" });
        await msg.react("🔓");
        await msg.react("✅")
    }

    if (
        reaction.message.id == config.supportmessage &&
        reaction.emoji.name == "✉️"
    ) {
        await reaction.users.remove(user.id);

        if (userTickets.has(user.id) && userTickets.get(user.id).status == "Open") {
            const msg = await reaction.message.channel.send(
                `:octagonal_sign: <@${user.id}>, Du hast schon ein Ticket -> <#${userTickets.get(user.id).channel}>`
            );
            setTimeout(function () {
                msg.delete();
            }, 10000);
            return;
        }

        if (
            userTickets.has(user.id) &&
            userTickets.get(user.id).status == "Closed"
        ) {
            const msg = await reaction.message.channel.send(
                `:mag: <@${user.id}>, Ich kann dir kein Ticket geben da du noch ein Ticket hast aber nur Teammitglieder es sehen kontaktiere ein Teammitglied.!`
            );
            return;
        }

        else {
            const un = user.username.split(" ");
            const supportchn = await reaction.message.channel.guild.channels.create(
                `${un[0]}'s-ticket`,
                {
                    reason: "Ticket System - Neues Ticket",
                    parent: config.categoryID,
                    topic: `Author ID: ${user.id} / Status: Open`,
                    permissionOverwrites: [
                        {
                            id: user.id,
                            allow: ["VIEW_CHANNEL"],
                        },
                        {
                            id: reaction.message.channel.guild.id,
                            deny: ["VIEW_CHANNEL"],
                        },
                        {
                            id: config.supportrole,
                            allow: ["VIEW_CHANNEL", "MANAGE_CHANNELS", "MANAGE_ROLES"],
                        },
                    ],
                }
            );
            var embed = {
                content: `Welcome <@${user.id}>!`,
                embed: {
                    description: `Du wirst gleich supportet bitte gedulde dich noch ein Bisschen,um dein Ticket zu schließen klicke die :lock: Reaktion.`,
                },
            };
            const isPremium = supportchn.guild.members.cache
                .get(user.id)
                ._roles.includes(config.premiumrole);
            if (isPremium) {
                embed.content = embed.content + `\n<@&${config.supportrole}>`;
            }
            var msg = await supportchn.send(embed);
            await msg.react("🔒");
            userTickets.set(user.id, { channel: supportchn.id, status: "Open" });
            msg = await reaction.message.channel.send(
                `:white_check_mark: <@${user.id}>, Ticket wurde geöffnet -> <#${userTickets.get(user.id).channel
                }>`
            );
            setTimeout(function () {
                msg.delete();
            }, 10000);
        }
    }
});

client.login(config.token);
