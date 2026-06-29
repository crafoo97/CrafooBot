import { Events, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getColor } from '../config/bot.js';
import { getGuildConfig } from '../services/guildConfig.js';
import { getWelcomeConfig } from '../utils/database.js';
import { formatWelcomeMessage } from '../utils/welcome.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { getServerCounters, updateCounter } from '../services/serverstatsService.js';
import { setBirthday as dbSetBirthday } from '../utils/database.js';
import { logger } from '../utils/logger.js';

export default {
  name: Events.GuildMemberAdd,
  once: false,
  
  async execute(member) {
    try {
        const { guild, user } = member;
        const config = await getGuildConfig(member.client, guild.id);
        const welcomeConfig = await getWelcomeConfig(member.client, guild.id);
        const welcomeChannelId = welcomeConfig?.channelId;

        if (welcomeConfig?.enabled && welcomeChannelId) {
            const channel = guild.channels.cache.get(welcomeChannelId);
            if (channel?.isTextBased?.()) {
                const me = guild.members.me;
                const permissions = me ? channel.permissionsFor(me) : null;
                if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
                    return;
                }

                const formatData = { user, guild, member };
                const welcomeMessage = formatWelcomeMessage(
                    welcomeConfig.welcomeMessage || "Welcome to the community! We are thrilled to have you join Crafoo's SMP. Check out your adventure card below!",
                    formatData
                );

                const messageContent = welcomeConfig.welcomePing ? user.toString() : null;
                const canEmbed = permissions.has(PermissionFlagsBits.EmbedLinks);

                if (!canEmbed) {
                    await channel.send({ content: messageContent || welcomeMessage });
                } else {
                    // ═════════════════ EXACT SCREENSHOT THEME (HARDCODED CHANNELS) ═════════════════
                    
                    // Yahan aap apne server ke hisab se channel IDs badal sakte hain agar automatic kaam na kare:
                    const protocolChannel = guild.channels.cache.find(c => c.name.toLowerCase().includes('protocol')) || { id: '125138381613940334' };
                    const generalChannel = guild.channels.cache.find(c => c.name.toLowerCase().includes('general') || c.name.toLowerCase().includes('chat')) || { id: '125138718332779234' };
                    const arcadeChannel = guild.channels.cache.find(c => c.name.toLowerCase().includes('arcade')) || { id: '125138718332779240' };

                    const embed = new EmbedBuilder()
                        .setColor('#5865F2') // Discord Premium Blue
                        .setTitle(`🪐 WELCOME TO ${guild.name.toUpperCase()}`)
                        .setDescription(welcomeMessage)
                        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .addFields(
                            { 
                                name: '📜 Read Protocols', 
                                value: `<#${protocolChannel.id}>\n↳ \`#protocol\` ↗`, 
                                inline: true 
                            },
                            { 
                                name: '💬 Main Chit-Chat', 
                                value: `<#${generalChannel.id}>\n↳ \`#general-chat\` ↗`, 
                                inline: true 
                            },
                            { 
                                name: '🕹️ Arcade Zone', 
                                value: `<#${arcadeChannel.id}>\n↳ \`#arcade\` ↗`, 
                                inline: true 
                            }
                        )
                        .setImage(welcomeConfig.welcomeImage || 'https://cdn.discordapp.com/attachments/151383816139403334/1513871833277923409/Gemini_Generated_Image_lhppm4lhppm4lhpp.png')
                        .setFooter({ text: `Member #${guild.memberCount} • Let's gooo! 🚀` });
                    
                    await channel.send({ 
                        content: messageContent,
                        embeds: [embed] 
                    });
                }
            }
        }
        
        // Auto-roles, logs, counters, and birthday backup logic remains exactly same...
        if (welcomeConfig?.roleIds && welcomeConfig.roleIds.length > 0) {
            const delay = welcomeConfig.autoRoleDelay || 0;
            const singleRoleId = welcomeConfig.roleIds[0];
            if (delay > 0) {
                const timeout = setTimeout(async () => {
                    const role = guild.roles.cache.get(singleRoleId);
                    if (role) await member.roles.add(role).catch(() => {});
                }, delay * 1000);
                if (typeof timeout.unref === 'function') timeout.unref();
            } else {
                const role = guild.roles.cache.get(singleRoleId);
                if (role) await member.roles.add(role).catch(() => {});
            }
        }
        
        if (config?.verification?.enabled || config?.verification?.autoVerify?.enabled) {
            const { autoVerifyOnJoin } = await import('../services/verificationService.js').catch(() => ({}));
            if (autoVerifyOnJoin) await autoVerifyOnJoin(member.client, guild, member, config.verification).catch(() => {});
        }

        try {
            await logEvent({
                client: member.client,
                guildId: guild.id,
                eventType: EVENT_TYPES.MEMBER_JOIN,
                data: {
                    title: 'User joined',
                    lines: [
                        `**User:** ${user.toString()} (${user.displayName !== user.username ? `@${user.displayName}` : user.tag})`,
                        `**ID:** \`${user.id}\``,
                        `**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
                        `**Members:** ${guild.memberCount}`,
                    ],
                    quoted: false,
                    thumbnail: user.displayAvatarURL({ dynamic: true }),
                    userId: user.id,
                }
            });
        } catch (e) {}

        try {
            const counters = await getServerCounters(member.client, guild.id);
            for (const counter of counters) {
                if (counter && counter.type && counter.channelId && counter.enabled !== false) {
                    await updateCounter(member.client, guild, counter);
                }
            }
        } catch (e) {}

        try {
            const backupKey = `guild:${guild.id}:birthdays:left`;
            const backup = (await member.client.db.get(backupKey)) || {};
            if (backup[user.id]) {
                const { month, day } = backup[user.id];
                await dbSetBirthday(member.client, guild.id, user.id, month, day);
                delete backup[user.id];
                await member.client.db.set(backupKey, backup);
            }
        } catch (e) {}
        
    } catch (error) {
        logger.error('Error in guildMemberAdd event:', error);
    }
  }
};
