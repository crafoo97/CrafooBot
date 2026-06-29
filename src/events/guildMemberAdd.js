import { Events, EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import { getColor } from '../config/bot.js';
import { getGuildConfig } from '../services/guildConfig.js';
import { getWelcomeConfig } from '../utils/database.js';
import { formatWelcomeMessage } from '../utils/welcome.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { getServerCounters, updateCounter } from '../services/serverstatsService.js';
import { setBirthday as dbSetBirthday } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import path from 'path';

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
                if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles])) {
                    return;
                }

                const messageContent = welcomeConfig.welcomePing ? user.toString() : null;
                const canEmbed = permissions.has(PermissionFlagsBits.EmbedLinks);

                if (!canEmbed) {
                    const welcomeMessage = "Welcome to the community! We are thrilled to have you join Crafoo's SMP. Check out your adventure card below!";
                    await channel.send({ content: messageContent || welcomeMessage });
                } else {
                    // 1. Dynamic Channel Finding
                    const protocolChan = guild.channels.cache.find(c => c.name.toLowerCase().includes('protocol'));
                    const generalChan = guild.channels.cache.find(c => c.name.toLowerCase().includes('general') || c.name.toLowerCase().includes('chat'));
                    const arcadeChan = guild.channels.cache.find(c => c.name.toLowerCase().includes('arcade'));

                    const protocolValue = protocolChan ? `<#${protocolChan.id}>` : '`#protocol`';
                    const generalValue = generalChan ? `<#${generalChan.id}>` : '`#general-chat`';
                    const arcadeValue = arcadeChan ? `<#${arcadeChan.id}>` : '`#arcade`';

                    // 2. Local Image Attachment Configuration
                    const imagePath = path.join(process.cwd(), 'Gemini_Generated_Image_lhppm4lhppm4lhpp_2.png');
                    const fileAttachment = new AttachmentBuilder(imagePath, { name: 'Gemini_Generated_Image_lhppm4lhppm4lhpp_2.png' });

                    // 3. Welcome Embed Construction
                    const embed = new EmbedBuilder()
                        .setColor('#5865F2') // Premium Blurple Color
                        .setTitle('🪐 WELCOME TO CRAFOO\'S SMP')
                        .setDescription("Welcome to the community! We are thrilled to have you join Crafoo's SMP. Check out your adventure card below!")
                        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                        .addFields(
                            { name: '📜 Read Protocols', value: protocolValue, inline: true },
                            { name: '💬 Main Chit-Chat', value: generalValue, inline: true },
                            { name: '🕹️ Arcade Zone', value: arcadeValue, inline: true }
                        )
                        .setImage('attachment://Gemini_Generated_Image_lhppm4lhppm4lhpp_2.png')
                        .setTimestamp()
                        .setFooter({ text: `Member #${guild.memberCount} • Let's gooo! 🚀` });
                    
                    await channel.send({ 
                        content: messageContent,
                        embeds: [embed],
                        files: [fileAttachment]
                    });
                }
            }
        }
        
        // Baki ka backup aur log system jo pehle tha wahi chalega...
        if (welcomeConfig?.roleIds && welcomeConfig.roleIds.length > 0) {
            const singleRoleId = welcomeConfig.roleIds[0];
            const role = guild.roles.cache.get(singleRoleId);
            if (role) await member.roles.add(role).catch(() => {});
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
                        `**User:** ${user.toString()}`,
                        `**ID:** \`${user.id}\``,
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
                if (counter && counter.channelId && counter.enabled !== false) {
                    await updateCounter(member.client, guild, counter);
                }
            }
        } catch (e) {}
        
    } catch (error) {
        logger.error('Error in guildMemberAdd event:', error);
    }
  }
};
